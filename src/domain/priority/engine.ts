import type { WaylineTask } from "../models";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const HEAT_WINDOW_MS = 30 * DAY_MS;

export type MatrixQuadrant = "I" | "II" | "III" | "IV";

export interface PriorityAnalysis {
  urgencyWeight: number;
  urgency: number;
  pressure: number;
  priority: number;
  matrixPosition: { x: number; y: number; quadrant: MatrixQuadrant };
  blocked: boolean;
  reason: string;
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Exact VisualDeadline importance-urgency-v1 deadline buckets. */
export function urgencyWeight(deadline: string | undefined, now = Date.now()): number {
  if (!deadline) return 0.5;
  const due = new Date(deadline).getTime();
  if (!Number.isFinite(due)) return 0.5;
  const remaining = due - now;
  if (remaining < 0) return 7;
  if (remaining <= HOUR_MS) return 6;
  if (remaining <= 6 * HOUR_MS) return 5;
  if (remaining <= DAY_MS) return 4;
  if (remaining <= 3 * DAY_MS) return 3;
  if (remaining <= 7 * DAY_MS) return 2;
  if (remaining <= 30 * DAY_MS) return 1;
  return 0.75;
}

/** Exact VisualDeadline pressure formula; progress is stored as 0..100. */
export function taskPressure(task: WaylineTask, now = Date.now()): number {
  const remainingProgress = 1 - clamp(task.progress, 0, 100) / 100;
  return round2(task.importance * urgencyWeight(task.deadline, now) * remainingProgress);
}

/** Exact VisualDeadline Top 3 score. */
export function priorityScore(task: WaylineTask, now = Date.now()): number {
  return taskPressure(task, now) * 10 + task.importance;
}

/** Exact VisualDeadline matrix horizontal deadline mapping. */
export function deadlinePosition(deadline: string | undefined, now = Date.now()): number {
  if (!deadline) return 6;
  const due = new Date(deadline).getTime();
  if (!Number.isFinite(due)) return 6;
  const remaining = due - now;
  if (remaining <= 0) return 96;
  if (remaining <= DAY_MS) return 90;
  if (remaining <= 3 * DAY_MS) return 76;
  if (remaining <= 7 * DAY_MS) return 58;
  if (remaining <= 30 * DAY_MS) return 32;
  return 14;
}

/** Exact VisualDeadline matrix vertical importance mapping. */
export function importancePosition(importance: number): number {
  return 8 + ((clamp(Math.round(importance), 1, 10) - 1) / 9) * 84;
}

export function matrixQuadrant(task: WaylineTask, now = Date.now()): MatrixQuadrant {
  const important = importancePosition(task.importance) >= 50;
  const urgent = deadlinePosition(task.deadline, now) >= 50;
  if (important && urgent) return "I";
  if (important) return "II";
  if (urgent) return "III";
  return "IV";
}

export function isActiveExecutable(task: WaylineTask): boolean {
  return task.actionable && !["done", "cancelled", "deferred"].includes(task.status);
}

export function isBlocked(task: WaylineTask, tasks: WaylineTask[]): boolean {
  if (!task.dependencies.length) return false;
  const byId = new Map(tasks.map((candidate) => [candidate.id, candidate]));
  return task.dependencies.some((id) => byId.get(id)?.status !== "done");
}

/** Exact wording branches from VisualDeadline, with dependency context appended. */
export function recommendationReason(task: WaylineTask, now = Date.now(), blocked = false): string {
  const urgency = Math.round(urgencyWeight(task.deadline, now) * 10);
  const base = task.importance >= 8 && urgency >= 30
    ? "高重要且接近截止"
    : urgency >= 40
      ? "截止时间很近"
      : task.importance >= 8 && urgency <= 20
        ? "长期重要任务，适合提前推进"
        : task.importance >= 7
          ? "重要性较高，值得优先推进"
          : urgency >= 30
            ? "截止时间较近，建议尽快处理"
            : "当前节奏合适，可以稳步推进";
  return blocked ? `${base}；需先完成前置任务` : base;
}

export function analyzeTask(task: WaylineTask, tasks: WaylineTask[], now = Date.now()): PriorityAnalysis {
  const blocked = isBlocked(task, tasks);
  const x = deadlinePosition(task.deadline, now);
  const y = importancePosition(task.importance);
  return {
    urgencyWeight: urgencyWeight(task.deadline, now),
    urgency: Math.round(urgencyWeight(task.deadline, now) * 10),
    pressure: taskPressure(task, now),
    priority: priorityScore(task, now),
    matrixPosition: { x, y, quadrant: matrixQuadrant(task, now) },
    blocked,
    reason: recommendationReason(task, now, blocked),
  };
}

export function rankTasks(tasks: WaylineTask[], now = Date.now()): WaylineTask[] {
  return tasks
    .filter(isActiveExecutable)
    .map((task, index) => ({ task, index, blocked: isBlocked(task, tasks), score: priorityScore(task, now) }))
    .sort((a, b) => b.score - a.score || Number(a.blocked) - Number(b.blocked) || b.task.importance - a.task.importance || a.index - b.index)
    .map(({ task }) => task);
}

export function topTasks(tasks: WaylineTask[], now = Date.now(), limit = 3): WaylineTask[] {
  const unblocked = tasks.filter((task) => isActiveExecutable(task) && !isBlocked(task, tasks));
  return rankTasks(unblocked, now).slice(0, limit);
}

/** VisualDeadline Heat Zone: within 30 days, deadline first, importance as tie-breaker. */
export function heatZoneTasks(tasks: WaylineTask[], now = Date.now(), limit = 12): WaylineTask[] {
  return tasks
    .filter((task) => isActiveExecutable(task) && task.deadline && new Date(task.deadline).getTime() - now <= HEAT_WINDOW_MS)
    .sort((a, b) => {
      const aDue = a.deadline ? new Date(a.deadline).getTime() : Number.POSITIVE_INFINITY;
      const bDue = b.deadline ? new Date(b.deadline).getTime() : Number.POSITIVE_INFINITY;
      return aDue - bDue || b.importance - a.importance;
    })
    .slice(0, limit);
}
