import type { AgentDecision, Project, Task, TaskChange } from "../types";
import { clamp, nowIso, uid } from "../time";
import { computeRisk } from "../metrics";
import { scheduleTasks } from "./scheduler";
import type { ReplanResult } from "../types";

export interface ConstraintParse {
  todayCapacityHours?: number;
  deltaHours?: number;
  slowTask?: string;
  summary: string;
}

/** Parse free-form constraint text into concrete numbers (deterministic rules). */
export function parseConstraint(text: string): ConstraintParse {
  const out: ConstraintParse = { summary: text.trim().slice(0, 300) };

  const hours = (): number | null => {
    const m = text.match(
      /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|\bh\b|小时|个?小时)/i
    );
    return m ? clamp(Number(m[1]), 0, 24) : null;
  };

  // "只剩 3 小时" / "only 3 hours" / "今天只有 3 小时"
  if (/只剩|只有|仅剩|only|剩下/.test(text)) {
    const h = hours();
    if (h !== null) out.todayCapacityHours = h;
  }

  // "Prototype 多用了 5 小时" / "took 5 hours longer"
  if (/多用了|took|用了|spent|over\s*by/.test(text)) {
    const h = hours();
    if (h !== null) out.deltaHours = h;
    const title = text.match(
      /prototype|原型|pilotdeck|agent|timeline|时间线|integration/i
    );
    if (title) out.slowTask = title[0].toLowerCase();
  }

  // "少了 4 小时" / "lost 4 hours" / class / meeting
  if (/少了|lost|缺|减了|class|课|meeting|会议|busy|占用/.test(text)) {
    const h = hours();
    if (h !== null) out.deltaHours = h;
  }

  return out;
}

const CANCEL_RE = /landing|marketing|pitch page/i;
const REDUCE_RE = /polish|visual|animation|transition|微调|打磨/i;
const FOCUS_RE = /pilotdeck|agent|integration|接入|集成/i;
const RESERVE_RE = /demo|presentation|答辩|pitch/i;

const DIFF_KEYS = [
  "start",
  "end",
  "estimatedHours",
  "priority",
  "status",
  "isCritical",
  "progress",
  "completedHours",
] as const;

function diffTasks(before: Task[], after: Task[]): TaskChange[] {
  const afterMap = new Map(after.map((t) => [t.id, t]));
  const changes: TaskChange[] = [];
  for (const b of before) {
    const a = afterMap.get(b.id);
    if (!a) continue;
    const changed = DIFF_KEYS.filter((k) => a[k] !== b[k]);
    if (changed.length === 0) continue;
    const beforePartial: Partial<Task> = {};
    const afterPartial: Partial<Task> = {};
    for (const k of changed) {
      (beforePartial as Record<string, unknown>)[k] = b[k];
      (afterPartial as Record<string, unknown>)[k] = a[k];
    }
    changes.push({ taskId: b.id, before: beforePartial, after: afterPartial });
  }
  return changes;
}

interface PolicyReport {
  action: string;
  detail: string;
  taskIds: string[];
}

function namesOf(tasks: Task[], ids: string[]): string {
  const map = new Map(tasks.map((t) => [t.id, t]));
  return ids.map((id) => map.get(id)?.title ?? id).join(", ");
}

/**
 * Replan: apply constraint-derived policies, re-pack the schedule,
 * recompute risk, and produce an APPLY-PLAN-ready result.
 */
export function replanProject(
  project: Project,
  constraintText: string,
  now = Date.now()
): ReplanResult {
  const c = parseConstraint(constraintText);
  const reports: PolicyReport[] = [];
  const changedTaskIds = new Set<string>();

  let todayCapacity = project.todayCapacityHours;
  const dailyCapacity = project.dailyCapacityHours;

  if (c.todayCapacityHours !== undefined) {
    const before = todayCapacity;
    todayCapacity = c.todayCapacityHours;
    reports.push({
      action: "CONSTRAINT",
      detail: `Available time today: ${before}h → ${todayCapacity}h`,
      taskIds: [],
    });
  }

  let tasks = project.tasks.map((t) => ({ ...t }));

  // 1. CANCEL low-priority nice-to-haves (landing pages, marketing)
  const cancelIds = tasks
    .filter(
      (t) =>
        t.status !== "done" &&
        !t.isCritical &&
        t.priority === "low" &&
        CANCEL_RE.test(t.title)
    )
    .map((t) => t.id);
  if (cancelIds.length) {
    tasks = tasks.map((t) =>
      cancelIds.includes(t.id) ? { ...t, status: "cancelled" as const } : t
    );
    reports.push({
      action: "CANCEL",
      detail: `Dropped ${namesOf(tasks, cancelIds)} (−${cancelIds.reduce((s, id) => s + (tasks.find((t) => t.id === id)?.estimatedHours ?? 0), 0)}h)`,
      taskIds: cancelIds,
    });
  }

  // 2. REDUCE + DEFER polish / animation work
  const reduceIds = tasks
    .filter(
      (t) => t.status !== "done" && !t.isCritical && REDUCE_RE.test(t.title)
    )
    .map((t) => t.id);
  if (reduceIds.length) {
    tasks = tasks.map((t) =>
      reduceIds.includes(t.id)
        ? {
            ...t,
            estimatedHours: Math.max(1, Math.round(t.estimatedHours * 0.5)),
            status: "deferred" as const,
          }
        : t
    );
    reports.push({
      action: "DEFER",
      detail: `Postponed polish/animation work and cut its budget 50% (${namesOf(tasks, reduceIds)})`,
      taskIds: reduceIds,
    });
  }

  // 3. FOCUS: critical integration task starts now
  const focusIds = tasks
    .filter((t) => t.status !== "done" && FOCUS_RE.test(t.title))
    .map((t) => t.id);
  if (focusIds.length) {
    tasks = tasks.map((t) =>
      focusIds.includes(t.id)
        ? {
            ...t,
            priority: "critical" as const,
            isCritical: true,
            status: "in_progress" as const,
          }
        : t
    );
    reports.push({
      action: "PRIORITIZE",
      detail: `"${namesOf(tasks, focusIds)}" moved to critical path and started`,
      taskIds: focusIds,
    });
  }

  // 4. RESERVE demo / presentation time
  const reserveIds = tasks
    .filter(
      (t) =>
        t.status !== "done" &&
        t.status !== "deferred" &&
        RESERVE_RE.test(t.title)
    )
    .map((t) => t.id);
  if (reserveIds.length) {
    tasks = tasks.map((t) =>
      reserveIds.includes(t.id)
        ? {
            ...t,
            priority: t.title.toLowerCase().includes("demo")
              ? ("critical" as const)
              : ("high" as const),
          }
        : t
    );
    reports.push({
      action: "RESERVE",
      detail: `Demo & presentation slots protected (${namesOf(tasks, reserveIds)})`,
      taskIds: reserveIds,
    });
  }

  // 5. ABSORB overrun into the in-progress task
  if (c.deltaHours !== undefined && c.slowTask) {
    const target =
      tasks.find(
        (t) =>
          t.status === "in_progress" &&
          !t.isCritical &&
          t.title.toLowerCase().includes(c.slowTask!)
      ) ?? tasks.find((t) => t.status === "in_progress");
    if (target) {
      tasks = tasks.map((t) =>
        t.id === target.id
          ? {
              ...t,
              completedHours: Math.min(
                t.estimatedHours,
                t.completedHours + c.deltaHours!
              ),
              progress: 1,
            }
          : t
      );
      reports.push({
        action: "ABSORB",
        detail: `"${target.title}" overran by ${c.deltaHours}h — absorbed into its existing slot`,
        taskIds: [target.id],
      });
    }
  }

  // 6. Re-pack the schedule with the new capacity
  const scheduled = scheduleTasks(
    tasks,
    project.createdAt,
    project.deadline,
    dailyCapacity,
    todayCapacity,
    now
  );
  tasks = scheduled.tasks;

  for (const id of [...cancelIds, ...reduceIds, ...focusIds, ...reserveIds]) {
    changedTaskIds.add(id);
  }

  const projectAfter: Project = {
    ...project,
    todayCapacityHours: todayCapacity,
    dailyCapacityHours: dailyCapacity,
    tasks,
    version: project.version + 1,
  };

  const risk = computeRisk(projectAfter, now);
  projectAfter.riskScore = risk.score;
  projectAfter.riskReason = risk.reasons.join(" · ");

  const explanation =
    reports.map((r) => `[${r.action}] ${r.detail}`).join("\n") ||
    "No actionable constraint detected — schedule unchanged.";

  const decision: AgentDecision = {
    id: uid("dec"),
    createdAt: nowIso(),
    kind: "replan",
    reason: constraintText.trim(),
    constraint: constraintText.trim(),
    explanation,
    changes: diffTasks(project.tasks, tasks),
  };

  return {
    project: projectAfter,
    decision,
    explanation,
    changedTaskIds: [...changedTaskIds],
    risk,
    constraint: constraintText.trim(),
  };
}
