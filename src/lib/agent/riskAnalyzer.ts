import type { Project, RiskInfo, Task } from "../types";
import { isWorkTask } from "../metrics";

export interface AgentInsight {
  statusText: string;
  bottleneck: string;
  bottleneckReason: string;
  recommendedAction: string;
}

/** The single most-loaded *unstarted* task (true bottleneck), else highest-priority unfinished. */
export function findBottleneck(project: Project): Task | null {
  const candidates = project.tasks.filter(
    (t) => isWorkTask(t) && t.status !== "done"
  );
  const weight = (x: Task) =>
    (x.isCritical ? 4 : x.priority === "high" ? 3 : x.priority === "medium" ? 2 : 1) +
    (x.isCritical && x.status === "todo" ? 10 : 0) + // unstarted critical work dominates
    (x.status === "in_progress" ? 1 : 0);
  const sorted = [...candidates].sort((a, b) => weight(b) - weight(a));
  return sorted[0] ?? null;
}

function dependentsOf(project: Project, taskId: string): Task[] {
  return project.tasks.filter((t) => t.dependencies.includes(taskId) && t.status !== "done");
}

export function buildInsight(project: Project, now: number, risk: RiskInfo): AgentInsight {
  const bottleneck = findBottleneck(project);

  const statusText =
    risk.scheduleGapHours < -0.5
      ? `Behind schedule by ${Math.abs(risk.scheduleGapHours).toFixed(1)}h`
      : risk.scheduleGapHours > 0.5
        ? `Ahead of schedule by ${risk.scheduleGapHours.toFixed(1)}h`
        : "On track against deadline";

  let bottleneckName = "—";
  let bottleneckReason = "All critical work is either done or in progress.";
  if (bottleneck) {
    bottleneckName = bottleneck.title;
    const deps = dependentsOf(project, bottleneck.id);
    bottleneckReason = deps.length
      ? `${deps.slice(0, 3).map((d) => d.title).join(", ")} ${deps.length > 1 ? "all depend" : "depends"} on it.`
      : `${bottleneck.title} is the largest chunk of remaining work.`;
  }

  // lowest-priority unfinished work that can be paused first
  const pauseable = project.tasks
    .filter((t) => isWorkTask(t) && t.status !== "done" && !t.isCritical)
    .sort((a, b) => priorityOf(a) - priorityOf(b))[0];

  let recommendedAction: string;
  if (risk.scheduleGapHours < -0.5 && bottleneck) {
    recommendedAction = pauseable
      ? `Stop polishing "${pauseable.title}". Finish "${bottleneck.title}" first.`
      : `Push "${bottleneck.title}" to done next.`;
  } else if (bottleneck) {
    recommendedAction = `Next: finish "${bottleneck.title}".`;
  } else {
    recommendedAction = "All remaining tasks are non-critical; hold the schedule.";
  }

  return { statusText, bottleneck: bottleneckName, bottleneckReason, recommendedAction };
}

function priorityOf(t: Task): number {
  if (t.priority === "low") return 1;
  if (t.priority === "medium") return 2;
  if (t.priority === "high") return 3;
  return 4;
}
