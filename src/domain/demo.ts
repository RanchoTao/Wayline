import type { WaylineProject, WaylineTask } from "./models";

const DAY_MS = 86_400_000;

export function buildWaylineDemo(now = Date.now()): { projects: WaylineProject[]; tasks: WaylineTask[] } {
  const createdAt = new Date(now - 2 * DAY_MS).toISOString();
  const project: WaylineProject = {
    id: "project-wayline-hackathon",
    title: "WAYLINE 黑客松",
    description: "把输入、排序、执行、回顾与重新计划连成可验证闭环。",
    createdAt,
    deadline: new Date(now + 8 * DAY_MS).toISOString(),
    importance: 10,
    status: "active",
  };
  // [title, importance, estimatedMinutes, dependencyIndex, progress, deadlineDays(negative => none)]
  const rows = [
    ["定义核心闭环与验收条件", 10, 90, -1, 100, 1],
    ["统一 Project / Task / Capture 数据模型", 10, 150, 0, 100, 2],
    ["实现 VisualDeadline Priority Engine", 10, 180, 1, 35, 3],
    ["完成 Unified Capture adapter", 9, 180, 1, 20, 4],
    ["完成多模态确认流程", 8, 120, 3, 0, 5],
    ["补齐计划矩阵与任务列表", 8, 150, 2, 0, 6],
    ["生成真实数据回顾", 8, 120, 1, 0, 21],
    ["跑通端到端黑客松演示", 10, 120, 6, 0, 8],
    ["回复黑客松群消息确认场地", 3, 15, -1, 0, 1],
    ["整理灵感截图文件夹", 2, 30, -1, 0, -1],
  ] as const;
  const tasks = rows.map(([title, importance, estimatedMinutes, dependencyIndex, progress, deadlineDays], index): WaylineTask => ({
    id: `demo-task-${index + 1}`,
    title,
    description: index === 2 ? "保持 VisualDeadline importance-urgency-v1 行为不变。" : undefined,
    projectId: project.id,
    createdAt,
    deadline: deadlineDays >= 0 ? new Date(now + Math.max(1, deadlineDays) * DAY_MS).toISOString() : undefined,
    importance,
    estimatedMinutes,
    completedMinutes: Math.round(estimatedMinutes * progress / 100),
    progress,
    status: progress === 100 ? "done" : progress > 0 ? "in_progress" : "ready",
    actionable: true,
    dependencies: dependencyIndex >= 0 ? [`demo-task-${dependencyIndex + 1}`] : [],
    source: "demo",
    createdByAI: false,
    completedAt: progress === 100 ? new Date(now - DAY_MS).toISOString() : undefined,
  }));
  return { projects: [project], tasks };
}
