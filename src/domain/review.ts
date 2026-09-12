import type { Review, ReviewRange, ReviewStatistics, WaylineProject, WaylineTask } from "./models";

const DAY_MS = 86_400_000;

function startOfDay(now: number): number {
  const date = new Date(now);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function reviewWindow(range: ReviewRange, now = Date.now()): { start: number; end: number } {
  const end = now;
  if (range === "today") return { start: startOfDay(now), end };
  if (range === "week") {
    const date = new Date(now);
    const day = (date.getDay() + 6) % 7;
    return { start: startOfDay(now) - day * DAY_MS, end };
  }
  return { start: startOfDay(now) - (range === "7d" ? 6 : 29) * DAY_MS, end };
}

const inWindow = (iso: string | undefined, start: number, end: number) => {
  if (!iso) return false;
  const value = new Date(iso).getTime();
  return Number.isFinite(value) && value >= start && value <= end;
};

export function computeReviewStatistics(
  tasks: WaylineTask[],
  projects: WaylineProject[],
  range: ReviewRange,
  now = Date.now(),
): ReviewStatistics {
  const { start, end } = reviewWindow(range, now);
  const executable = tasks.filter((task) => task.actionable);
  const completed = executable.filter((task) => task.status === "done" && inWindow(task.completedAt, start, end));
  const planned = executable.filter((task) => new Date(task.createdAt).getTime() <= end && task.status !== "cancelled");
  const deferred = executable.filter((task) => task.status === "deferred" || (task.deadline && new Date(task.deadline).getTime() < end && !["done", "cancelled"].includes(task.status)));
  const cancelled = executable.filter((task) => task.status === "cancelled" && inWindow(task.createdAt, start, end));
  const created = executable.filter((task) => inWindow(task.createdAt, start, end));
  const projectName = new Map(projects.map((project) => [project.id, project.title]));
  const completedByProject = new Map<string, number>();
  const deferredByProject = new Map<string, number>();
  for (const task of completed) {
    if (task.projectId) completedByProject.set(task.projectId, (completedByProject.get(task.projectId) ?? 0) + (task.completedMinutes ?? task.estimatedMinutes ?? 0));
  }
  for (const task of deferred) {
    if (task.projectId) deferredByProject.set(task.projectId, (deferredByProject.get(task.projectId) ?? 0) + 1);
  }
  const maxName = (map: Map<string, number>) => {
    const entry = [...map.entries()].sort((a, b) => b[1] - a[1])[0];
    return entry ? projectName.get(entry[0]) : undefined;
  };
  const timed = completed.filter((task) => task.estimatedMinutes && task.completedMinutes !== undefined);
  const estimateVarianceMinutes = timed.length
    ? Math.round(timed.reduce((sum, task) => sum + (task.completedMinutes! - task.estimatedMinutes!), 0) / timed.length)
    : undefined;
  return {
    plannedTasks: planned.length,
    completedTasks: completed.length,
    completionRate: planned.length ? Math.round((completed.length / planned.length) * 100) : 0,
    deferredTasks: deferred.length,
    cancelledTasks: cancelled.length,
    newTasks: created.length,
    biggestProgressProject: maxName(completedByProject),
    mostDeferredProject: maxName(deferredByProject),
    estimateVarianceMinutes,
  };
}

export function buildReview(tasks: WaylineTask[], projects: WaylineProject[], range: ReviewRange, now = Date.now()): Review {
  const { start, end } = reviewWindow(range, now);
  const statistics = computeReviewStatistics(tasks, projects, range, now);
  const facts = [
    `完成 ${statistics.completedTasks} 项，计划池共 ${statistics.plannedTasks} 项，完成率 ${statistics.completionRate}%。`,
    `新增 ${statistics.newTasks} 项，延期 ${statistics.deferredTasks} 项，取消 ${statistics.cancelledTasks} 项。`,
  ];
  if (statistics.biggestProgressProject) facts.push(`推进最多的项目是「${statistics.biggestProgressProject}」。`);
  const patterns: string[] = [];
  if (statistics.mostDeferredProject) patterns.push(`「${statistics.mostDeferredProject}」出现最多延期。`);
  if (statistics.estimateVarianceMinutes !== undefined && statistics.estimateVarianceMinutes > 15) patterns.push(`完成任务平均比预估多 ${statistics.estimateVarianceMinutes} 分钟。`);
  if (statistics.completionRate < 50 && statistics.plannedTasks >= 3) patterns.push("当前计划池明显大于近期完成量。");
  const suggestions: Review["suggestions"] = [];
  const deferredProject = projects.find((project) => project.title === statistics.mostDeferredProject);
  if (statistics.estimateVarianceMinutes !== undefined && statistics.estimateVarianceMinutes > 15) {
    suggestions.push({ id: `estimate-${range}-${start}`, title: "提高后续任务估时", reason: "近期实际用时持续高于预估。", estimateMultiplier: 1.5, status: "pending" });
  }
  if (deferredProject) {
    suggestions.push({ id: `focus-${range}-${start}`, title: `收缩「${deferredProject.title}」并行任务`, reason: "该项目在当前周期延期最多。", projectId: deferredProject.id, status: "pending" });
  }
  return {
    id: `review-${range}-${start}`,
    range,
    periodStart: new Date(start).toISOString(),
    periodEnd: new Date(end).toISOString(),
    createdAt: new Date(now).toISOString(),
    statistics,
    facts,
    patterns,
    suggestions,
    narrative: [...facts, ...patterns, suggestions.length ? `系统给出 ${suggestions.length} 条待确认调整。` : "当前没有足够证据提出计划调整。"].join("\n"),
  };
}
