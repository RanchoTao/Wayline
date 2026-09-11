import type { Task } from "../types";
import { DAY_MS, HOUR_MS, parseIso, toIso } from "../time";

function priorityWeight(t: Task): number {
  if (t.isCritical) return 4;
  if (t.priority === "high") return 3;
  if (t.priority === "medium") return 2;
  return 1;
}

/** Topological order (dependencies first); ties broken by priority desc. */
export function orderTasks(tasks: Task[]): Task[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const visited = new Set<string>();
  const out: Task[] = [];

  const visit = (t: Task) => {
    if (visited.has(t.id)) return;
    visited.add(t.id);
    for (const dep of t.dependencies) {
      const d = byId.get(dep);
      if (d) visit(d);
    }
    out.push(t);
  };

  const sorted = [...tasks].sort(
    (a, b) =>
      priorityWeight(b) - priorityWeight(a) || a.title.localeCompare(b.title)
  );
  for (const t of sorted) visit(t);
  return out;
}

export interface ScheduleResult {
  tasks: Task[];
  scale: number;
  capacityHours: number;
  requiredHours: number;
}

const HOURS_PER_DAY = 24;

/**
 * Deterministic time-space packing:
 *  - done tasks      → packed from the project start (past)
 *  - in_progress     → anchored around `now` (completed part in the past,
 *                      remaining part crosses the NOW line)
 *  - todo            → packed from `now` toward the deadline
 *  - deferred/cancelled → keep their previous dates, skipped
 * Durations are derived from estimated hours at `dailyCapacityHours`/day and
 * compressed uniformly when required work exceeds remaining capacity.
 */
export function scheduleTasks(
  tasks: Task[],
  fromIso: string,
  deadlineIso: string,
  dailyCapacityHours: number,
  todayCapacityHours: number,
  now = Date.now()
): ScheduleResult {
  const fromT = parseIso(fromIso);
  const toT = parseIso(deadlineIso);

  const doneTasks = orderTasks(
    tasks.filter((t) => t.status === "done")
  );
  // in_progress first (they are happening NOW), then todo tasks
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress");
  const todoTasks = orderTasks(tasks.filter((t) => t.status === "todo"));
  const frozen = tasks.filter(
    (t) => t.status !== "done" && t.status !== "todo" && t.status !== "in_progress"
  );

  const requiredHours = todoTasks.reduce((s, t) => {
    const remaining = Math.max(0, t.estimatedHours - t.progress * t.estimatedHours);
    return s + remaining;
  }, 0);

  const activeFrom = Math.max(fromT, now);
  const fullDays = Math.max(0, (toT - activeFrom) / DAY_MS - 1);
  const capacityHours = todayCapacityHours + dailyCapacityHours * fullDays;
  const scale =
    requiredHours > 0 ? Math.min(1, capacityHours / requiredHours) : 1;

  const durMs = (hours: number) =>
    Math.max(
      1 * HOUR_MS,
      (hours / Math.max(1, dailyCapacityHours)) * HOURS_PER_DAY * HOUR_MS * scale
    );

  const gapMs = scale < 0.9 ? 0.25 * HOUR_MS : 0.5 * HOUR_MS;

  // --- done tasks: pack from project start ---
  let pastCursor = fromT;
  const packedDone = doneTasks.map((t) => {
    const start = pastCursor;
    const end = Math.min(toT, start + durMs(t.estimatedHours));
    pastCursor = Math.min(toT, end + gapMs);
    return { ...t, start: toIso(start), end: toIso(end) };
  });

  // --- in-progress tasks: straddle `now` (completed part in the past) ---
  const packedInProgress = inProgressTasks.map((t) => {
    const completed = Math.min(t.completedHours, t.estimatedHours);
    const start = Math.max(fromT, now - durMs(completed));
    const end = Math.min(toT, start + durMs(t.estimatedHours));
    return { ...t, start: toIso(start), end: toIso(end) };
  });
  // todo cursor starts after the longest in-progress tail
  let cursor = Math.max(fromT, now);
  for (const t of packedInProgress) {
    const completed = Math.min(t.completedHours, t.estimatedHours);
    const remaining = Math.max(0, t.estimatedHours - completed);
    cursor = Math.max(cursor, parseIso(t.start) + durMs(remaining) + gapMs);
  }

  // --- todo tasks: pack from the cursor toward the deadline ---
  const packedTodo = todoTasks.map((t) => {
    const start = cursor;
    const end = Math.min(toT, start + durMs(t.estimatedHours));
    cursor = Math.min(toT, start + durMs(t.estimatedHours) + gapMs);
    return { ...t, start: toIso(start), end: toIso(end) };
  });

  return {
    tasks: [...frozen, ...packedDone, ...packedInProgress, ...packedTodo],
    scale,
    capacityHours,
    requiredHours,
  };
}
