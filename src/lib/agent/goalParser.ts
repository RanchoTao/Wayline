import { addHours, clamp01, nowIso } from "../time";

export type GoalIntent = "hackathon" | "paper" | "exam" | "generic";

export interface ParsedGoal {
  intent: GoalIntent;
  title: string;
  summary: string;
  deadlineIso: string | null;
  /** true when the deadline was extracted from free text */
  deadlineFromText: boolean;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Lightweight, deterministic deadline extraction. Returns ISO or null. */
export function extractDeadline(text: string, now = Date.now()): string | null {
  const d = new Date(now);

  // ISO date: 2026-09-20
  const iso = text.match(/(20\d{2})[-/年](\d{1,2})[-/月](\d{1,2})/);
  if (iso) {
    const t = new Date(
      Number(iso[1]),
      Number(iso[2]) - 1,
      Number(iso[3]),
      18,
      0,
      0
    );
    if (!Number.isNaN(t.getTime())) return t.toISOString();
  }

  // Chinese: 9月20日 / 9 月 20 号 (current or next year if already past)
  const zh = text.match(
    /(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/
  );
  if (zh) {
    const t = new Date(d.getFullYear(), Number(zh[1]) - 1, Number(zh[2]), 18, 0, 0);
    if (t.getTime() < now - 36e5) t.setFullYear(t.getFullYear() + 1);
    if (!Number.isNaN(t.getTime())) return t.toISOString();
  }

  // English: Sep 20 / September 20th / 20 Sep
  const en =
    text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i) ??
    text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\b/i);
  if (en) {
    const monthIdx = /^\d/.test(en[0]) ? en[2] : en[1];
    const dayIdx = /^\d/.test(en[0]) ? en[1] : en[2];
    const month = MONTHS[monthIdx.toLowerCase().slice(0, 3)];
    const day = Number(dayIdx);
    if (month && day >= 1 && day <= 31) {
      const t = new Date(d.getFullYear(), month - 1, day, 18, 0, 0);
      if (t.getTime() < now - 36e5) t.setFullYear(t.getFullYear() + 1);
      if (!Number.isNaN(t.getTime())) return t.toISOString();
    }
  }

  // Relative: in 3 days / 一周后 / tomorrow / 明天 / 下周
  const rel = text.match(/(?:in\s+)?(\d+)\s*(?:days?|天|日)/i);
  if (rel) {
    return addHours(nowIso(), Number(rel[1]) * 24);
  }
  if (/\btomorrow\b|明天|明日/.test(text)) {
    const t = new Date(now + 24 * 36e5);
    return new Date(t.getFullYear(), t.getMonth(), t.getDate(), 18, 0, 0).toISOString();
  }
  if (/下周|next week/.test(text)) {
    return addHours(nowIso(), 7 * 24);
  }

  return null;
}

function detectIntent(text: string): GoalIntent {
  if (
    /hackathon|hackathon|黑客松|创想|hack\s*athon|competition|比赛|demo\s*day/i.test(text)
  ) {
    return "hackathon";
  }
  if (/research|paper|论文|thesis|实验|实验报告/i.test(text)) {
    return "paper";
  }
  if (/exam|考试|面试|interview|quiz|test prep/i.test(text)) {
    return "exam";
  }
  return "generic";
}

/** Strip date-like tokens so they don't pollute the title. */
function cleanTitle(text: string): string {
  return text
    .replace(/(20\d{2})[-/年](\d{1,2})[-/月](\d{1,2})/g, " ")
    .replace(/\d{1,2}\s*月\s*\d{1,2}\s*[日号]/g, " ")
    .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?\b/gi, " ")
    .replace(/\b\d{1,2}(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\b/gi, " ")
    .replace(/之前|以前|deadline|by\s|due\s/i, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseGoal(text: string, now = Date.now()): ParsedGoal {
  const trimmed = text.trim();
  const deadline = extractDeadline(trimmed, now);
  const cleaned = cleanTitle(trimmed);
  const sentences = cleaned.split(/[。！？!?.]/).map((s) => s.trim()).filter(Boolean);
  const first = sentences[0] ?? cleaned;
  // first clause (comma- or CJK-punctuation-delimited), capped length
  const clause = first.split(/[,，、]/)[0] ?? first;
  const words = clause.split(/\s+/).filter(Boolean).slice(0, 8).join(" ");
  const title = words.length > 28 ? `${words.slice(0, 28)}…` : words || "Untitled goal";
  const summary = trimmed.slice(0, 400);

  return {
    intent: detectIntent(trimmed),
    title,
    summary,
    deadlineIso: deadline,
    deadlineFromText: deadline !== null,
  };
}

/** Heuristic: how much of a goal statement is a *constraint*, not a goal. */
export function looksLikeConstraint(text: string): boolean {
  return /只剩|只有|only .{0,12}hours?|多用了|took .{0,16}(longer|more)|少了|(?:have|has|gets?) less|课程|class|meeting|会议|提前|postpone|取消|cancel|少|due\s+shift|减少/i.test(
    text
  );
}

export function extractConstraintHours(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|\bh\b|小时|个?小时)/i);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) ? clamp01(v / 24) * 24 : null; // clamp to 0..24h
}
