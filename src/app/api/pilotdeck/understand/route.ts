import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// PILOTDECK BRIDGE (server-side only)
// Reads the PilotDeck host config ($PILOT_HOME/pilotdeck.yaml) at request time
// to obtain the real OpenAI-compatible endpoint + key + model. The key never
// leaves this server process: it is never sent to the browser and never logged.
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;


type Body = {
  inputType: "text" | "voice" | "image";
  text: string;
  imageDataUrl?: string; // data:image/...;base64,....
  /** Project-local test hook. It never reads or changes PilotDeck config. */
  forceFailure?: boolean;
};

const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);
const RETRY_BACKOFF_MS = 250;
const ATTEMPT_TIMEOUT_MS = 30_000;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function loadPilotDeckConfig() {
  const dir = process.env.PILOT_HOME || join(homedir(), ".pilotdeck");
  const raw = readFileSync(join(dir, "pilotdeck.yaml"), "utf8");
  const urlMatch = raw.match(/^\s+url:\s*(\S+)/m);
  const keyMatch = raw.match(/^\s+apiKey:\s*(\S+)/m);
  if (!urlMatch || !keyMatch) {
    return { ok: false as const, reason: "pilotdeck.yaml missing url/apiKey" };
  }
  const stripQuotes = (value: string) => value.replace(/^["']|["']$/g, "");
  // Parse per-model image support. Block shape in pilotdeck.yaml:
  //   models:
  //     minimax-m3:
  //       multimodal:
  //         input: [text, image]
  //       connectionTest: { imageInput: supported, ... }
  const modelImageFlags = new Map<string, boolean>();
  const modelLines = raw.split(/\r?\n/);
  for (let i = 0; i < modelLines.length; i++) {
    const m = modelLines[i].match(/^(\s{8})([\w.-]+):\s*$/);
    if (!m) continue;
    const name = m[2];
    let imageInput: string | undefined;
    for (let j = i + 1; j < modelLines.length; j++) {
      const line = modelLines[j];
      if (/^\S/.test(line)) break; // dedent to column 0 ends the models block
      const indent = (line.match(/^\s*/) ?? [""])[0].length;
      if (indent <= 8 && /\S/.test(line)) break; // next sibling model
      const img = line.match(/imageInput:\s*(\S+)/);
      if (img) { imageInput = img[1]; break; }
    }
    modelImageFlags.set(name, imageInput === "supported");
  }
  const imageModels = [...modelImageFlags.entries()].filter(([, v]) => v).map(([k]) => k);
  const textModels = [...modelImageFlags.entries()].filter(([, v]) => !v).map(([k]) => k);
  const model =
    process.env.PILOTDECK_MODEL ||
    (imageModels[0] ?? textModels[0] ?? "minimax-m3");
  return {
    ok: true as const,
    baseUrl: stripQuotes(urlMatch[1]).replace(/\/$/, ""),
    apiKey: stripQuotes(keyMatch[1]),
    model,
    imageModels,
    textModels,
  };
}

const SYSTEM_PROMPT = `You are the Understand / Actionability / Decompose stage of WAYLINE, a deadline cockpit built on the PilotDeck track.

The user describes something. Decide:

- intent: "task" | "project" | "event" | "note"
- actionable: TRUE only if the thing can be STARTED right now as one concrete executable unit (e.g. "完成第三章习题1-10", "修改Figure 3 caption"). FALSE for goals/projects that need decomposition (e.g. "准备机器学习考试", "参加黑客松").
- title: short, concrete, human title in the user's language.
- description: optional one-line clarification.
- deadlineIso: absolute ISO string. Use ONLY the current date given below; never invent dates not mentioned by the user. If no deadline is mentioned, null.
- importance: 1-10.
- estimatedMinutes: best guess for ONE sitting / the full job (for projects: total).
- parentGoal: for actionable leaf tasks, the goal/project they belong to (may be null).
- suggestedTasks: when intent is "project" or the input contains multiple distinct action requirements: 3-8 executable leaf tasks that together achieve it. Each must be startable without further thinking ("复习第1-2章并整理笔记", "完成课程习题", "做一次模拟测试", "周五前回复老师"). ALWAYS output suggestedTasks for projects — never an empty array. If the input is already a single actionable task, return an empty array.
- warnings: any ambiguity you noticed.

Current date for deadline computation: ${new Date().toISOString()}.

Reply with ONLY a single valid JSON object, no markdown fences, no commentary.`;

function toOpenAIMessages(body: Body) {
  if (body.inputType === "image" && body.imageDataUrl) {
    const userText = `以下是用户上传的图片（可能是课程通知/群通知/作业截图/会议截图）。请读取其中的时间、要求、截止日期等信息。\n\n图片说明/OCR补充（若有）：${body.text || "（无）"}\n\n注意：图片通常包含多项要求。如果图片里有多于一个的独立行动要求（例如复习多章 + 做练习题 + 模拟测试 + 回复老师），请将 intent 判定为 "project"，actionable 为 false，并用 suggestedTasks 拆解为可执行步骤。若图片确实只描述一个可直接执行的行动，才判定为单个 task。`;
    return [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          { type: "image_url", image_url: { url: body.imageDataUrl } },
        ],
      },
    ];
  }
  const userText = body.inputType === "image"
    ? `以下是用户上传的图片描述：${body.text || "（无）"}`
    : body.text;
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userText },
  ];
}

function parseJsonLoose(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("no JSON object in reply");
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function POST(request: Request) {
  const started = Date.now();
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid request body" }, { status: 400 });
  }

  if (!(["text", "voice", "image"] as const).includes(body.inputType) || typeof body.text !== "string") return NextResponse.json({ ok: false, reason: "invalid capture input" }, { status: 400 });
  if (body.imageDataUrl && body.imageDataUrl.length > 12_000_000) return NextResponse.json({ ok: false, reason: "image payload too large" }, { status: 413 });
  // P4 uses only this request-scoped hook: no ~/.pilotdeck, environment,
  // credentials, registry, or model-pool configuration is ever changed.
  if (body.forceFailure) return NextResponse.json({ ok: false, reason: "forced project-local PilotDeck failure" }, { status: 503 });

  const config = loadPilotDeckConfig();
  if (!config.ok) {
    return NextResponse.json({ ok: false, reason: config.reason }, { status: 503 });
  }

  try {
    // Exactly one retry for explicitly transient failures only.
    let res: Response | undefined;
    let retryCount = 0;
    let failureKind = "unavailable";
    for (let attempt = 0; attempt < 2 && !res; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
      try {
        const candidate = await fetch(`${config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.model,
            messages: toOpenAIMessages(body),
            max_tokens: 4000,
            temperature: 0.2,
          }),
          signal: controller.signal,
        });
        if (candidate.ok) {
          res = candidate;
        } else {
          failureKind = `upstream-${candidate.status}`;
          if (!RETRYABLE_STATUS.has(candidate.status)) break;
        }
      } catch (err) {
        failureKind = err instanceof Error && err.name === "AbortError" ? "timeout" : "network";
      } finally {
        clearTimeout(timer);
      }
      if (!res && attempt === 0 && ["timeout", "network", "upstream-429", "upstream-502", "upstream-503", "upstream-504"].includes(failureKind)) {
        retryCount = 1;
        await wait(RETRY_BACKOFF_MS);
      }
    }
    if (!res) {
      return NextResponse.json(
        { ok: false, reason: `PilotDeck ${failureKind}` },
        { status: 502 },
      );
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ ok: false, reason: "empty model reply" }, { status: 502 });
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = parseJsonLoose(content) as Record<string, unknown>;
    } catch (err) {
      return NextResponse.json({ ok: false, reason: `JSON parse failed: ${String(err)}` }, { status: 502 });
    }

    const normalizeTasks = (raw: unknown) => {
      if (!Array.isArray(raw)) return [];
      return raw.map((t, i) => {
        if (typeof t === "string") {
          return { title: t, importance: 8, actionable: true };
        }
        const item = (t ?? {}) as Record<string, unknown>;
        const titleRaw = item.title ?? item.name ?? item.task ?? item.label;
        return {
          title: titleRaw != null ? String(titleRaw) : `子任务 ${i + 1}`,
          description: item.description ? String(item.description) : undefined,
          importance: clampInt(item.importance, 8, 1, 10),
          estimatedMinutes: item.estimatedMinutes != null ? Math.max(1, Math.round(Number(item.estimatedMinutes))) : undefined,
          actionable: true,
          dependsOnIndexes: Array.isArray(item.dependsOnIndexes)
            ? item.dependsOnIndexes.map((d) => Math.max(0, Math.round(Number(d))))
            : undefined,
        };
      });
    };

    const deadline = typeof parsed.deadlineIso === "string"
      ? new Date(parsed.deadlineIso).toISOString()
      : undefined;
    const result = {
      rawInput: body.text,
      normalizedText: String(parsed.normalizedText ?? body.text),
      inputType: body.inputType,
      intent: ["task", "project", "event", "note", "unknown"].includes(String(parsed.intent))
        ? String(parsed.intent)
        : "unknown",
      title: String(parsed.title ?? body.text).slice(0, 120),
      description: parsed.description ? String(parsed.description).slice(0, 500) : undefined,
      deadline,
      importance: clampInt(parsed.importance, 5, 1, 10),
      estimatedDuration: parsed.estimatedMinutes != null ? Math.max(1, Math.round(Number(parsed.estimatedMinutes))) : undefined,
      actionable: parsed.actionable === true,
      confidence: clamp01(parsed.confidence),
      parentGoal: parsed.parentGoal ? String(parsed.parentGoal) : undefined,
      suggestedTasks: normalizeTasks(parsed.suggestedTasks),
      provider: "PILOTDECK",
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
    };

    return NextResponse.json({
      ok: true,
      result,
      meta: {
        provider: "PILOTDECK",
        model: config.model,
        requestType: body.inputType === "image" ? "multimodal" : "text",
        latencyMs: Date.now() - started,
        retryCount,
        fallback: false,
      },
    });
  } catch (err) {
    const reason = err instanceof Error && err.name === "AbortError" ? "timeout" : String(err);
    return NextResponse.json({ ok: false, reason }, { status: 502 });
  }
}

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}
function clamp01(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.8;
}
