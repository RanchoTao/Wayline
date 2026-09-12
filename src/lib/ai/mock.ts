import type { CaptureDraftInput, CaptureResult, SuggestedTask } from "@/domain/models";
import type { CaptureProvider } from "./types";

const DAY_MS = 86_400_000;

function isoAt(now: number, days: number, hour = 18): string {
  const date = new Date(now + days * DAY_MS);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function extractDeadline(text: string, now: number): string | undefined {
  if (/半年后|六个月后/.test(text)) return isoAt(now, 183);
  const weeks = text.match(/(\d+|两)\s*周后/);
  if (weeks) return isoAt(now, weeks[1] === "两" ? 14 : Number(weeks[1]) * 7);
  const days = text.match(/(\d+)\s*天后/);
  if (days) return isoAt(now, Number(days[1]));
  if (/明天|明晚/.test(text)) return isoAt(now, 1);
  if (/今晚|今天晚上/.test(text)) return isoAt(now, 0, 22);
  const iso = text.match(/(20\d{2})[-/年](\d{1,2})[-/月](\d{1,2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 18).toISOString();
  return undefined;
}

function extractImportance(text: string): number | undefined {
  const match = text.match(/(?:重要性|importance)\s*[:：]?\s*(10|[1-9])/i);
  return match ? Number(match[1]) : undefined;
}

function examTasks(text: string): SuggestedTask[] {
  const chapterRange = /(?:1\s*[-到至]\s*8|第?\s*1\s*[-到至]\s*8\s*章)/.test(text);
  const names = chapterRange
    ? ["整理考试范围与资料", "复习第 1-2 章并整理笔记", "复习第 3-4 章并整理笔记", "复习第 5-6 章并整理笔记", "复习第 7-8 章并整理笔记", "完成课程习题", "完成一次模拟测试", "整理模拟测试错题"]
    : ["整理考试范围与资料", "梳理核心概念与公式", "复习课程笔记", "完成课程习题", "完成一次模拟测试", "整理错题并复习薄弱点"];
  const minutes = chapterRange ? [45, 120, 120, 120, 120, 180, 120, 90] : [45, 120, 120, 180, 120, 90];
  return names.map((title, index) => ({
    title,
    importance: index === names.length - 2 ? 10 : 8,
    estimatedMinutes: minutes[index],
    actionable: true,
    dependsOnIndexes: index === 0 ? [] : [index - 1],
  }));
}

function genericProjectTasks(title: string): SuggestedTask[] {
  return [
    { title: `明确「${title}」的完成标准`, importance: 8, estimatedMinutes: 45, actionable: true, dependsOnIndexes: [] },
    { title: `收集「${title}」所需资料与限制`, importance: 8, estimatedMinutes: 60, actionable: true, dependsOnIndexes: [0] },
    { title: `完成「${title}」的第一版产物`, importance: 9, estimatedMinutes: 120, actionable: true, dependsOnIndexes: [1] },
    { title: `检查第一版并列出修改项`, importance: 7, estimatedMinutes: 45, actionable: true, dependsOnIndexes: [2] },
    { title: `完成修改并确认交付`, importance: 9, estimatedMinutes: 90, actionable: true, dependsOnIndexes: [3] },
  ];
}

function isActionable(text: string): boolean {
  if (/习题\s*\d+(?:\.\d+)?\s*[-到至]\s*\d+|第\s*\d+\s*章.{0,12}(习题|阅读)|实现.{0,20}(adapter|适配器|接口)|预订.{0,20}机票|整理.{0,20}(文件夹|PDF)|完成.{0,20}\d+\s*[-到至]\s*\d+/i.test(text)) return true;
  if (/(准备|完成|复习|规划|重建|开发).{0,20}(考试|黑客松|ICLR|旅行|系统|项目)/i.test(text)) return false;
  return /^(阅读|实现|完成|整理|预订|修改|编写|提交|联系|检查|复习)/.test(text.trim()) && text.trim().length >= 8;
}

function cleanTitle(text: string): string {
  return text.replace(/(?:重要性|importance)\s*[:：]?\s*(10|[1-9])/ig, "").replace(/^(我要|请|帮我)\s*/, "").trim().slice(0, 48) || "未命名事项";
}

function fingerprint(bytes: ArrayBuffer): string {
  const values = new Uint8Array(bytes);
  let hash = 2166136261;
  for (let index = 0; index < values.length; index += Math.max(1, Math.floor(values.length / 2048))) {
    hash ^= values[index];
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export class MockCaptureProvider implements CaptureProvider {
  readonly name = "WAYLINE LOCAL UNDERSTANDING";
  readonly isMock = true;
  readonly capabilities = { text: true, voiceTranscript: true, imageUnderstanding: "browser-ocr-or-context" as const };

  async understand(input: CaptureDraftInput, now = Date.now()): Promise<CaptureResult> {
    const normalizedText = input.text.replace(/\s+/g, " ").trim();
    const warnings: string[] = [];
    if (input.media) {
      const id = fingerprint(input.media.bytes);
      if (!input.media.bytes.byteLength) throw new Error("附件为空，无法进入理解流程。");
      warnings.push(`媒体已进入 pipeline：${input.media.name} · ${input.media.bytes.byteLength} bytes · ${id}`);
    }
    if (!normalizedText) throw new Error(input.inputType === "image" ? "当前本地 provider 未检测到可用 OCR 文本，请补充图片内容后再分析。" : "没有可供理解的文字内容。");
    const deadline = extractDeadline(normalizedText, now);
    const importance = extractImportance(normalizedText) ?? (/考试|黑客松|提交|截止/.test(normalizedText) ? 8 : 6);
    const actionable = isActionable(normalizedText);
    const isExam = /考试|考研|测验/.test(normalizedText);
    const title = cleanTitle(normalizedText);
    const suggestedTasks = actionable
      ? [{ title, description: normalizedText, importance, estimatedMinutes: /习题/.test(normalizedText) ? 50 : 45, actionable: true, dependsOnIndexes: [] }]
      : isExam
        ? examTasks(normalizedText)
        : genericProjectTasks(title);
    return {
      rawInput: normalizedText,
      normalizedText,
      inputType: input.inputType,
      intent: actionable ? "task" : "project",
      title: isExam && !actionable ? "机器学习考试准备" : title,
      description: normalizedText,
      deadline,
      importance,
      estimatedDuration: suggestedTasks.reduce((sum, task) => sum + (task.estimatedMinutes ?? 0), 0),
      actionable,
      confidence: input.inputType === "text" ? 0.9 : 0.78,
      parentGoal: actionable ? undefined : title,
      suggestedTasks,
      provider: this.name,
      warnings,
    };
  }
}
