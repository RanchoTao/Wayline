import type { Project as LegacyProject, Task as LegacyTask } from "@/lib/types";
import type { WaylineProject, WaylineTask } from "./models";

const importanceOf = (task: LegacyTask) => task.priority === "critical" ? 10 : task.priority === "high" ? 8 : task.priority === "medium" ? 6 : 3;

export function migrateLegacyProject(project: LegacyProject): { projects: WaylineProject[]; tasks: WaylineTask[] } {
  const migratedProject: WaylineProject = {
    id: project.id,
    title: project.title,
    description: project.description,
    createdAt: project.createdAt,
    deadline: project.deadline,
    importance: project.tasks.some((task) => task.priority === "critical") ? 10 : 8,
    status: project.status === "completed" ? "completed" : "active",
  };
  const tasks = project.tasks.map((task): WaylineTask => ({
    id: task.id,
    title: task.title,
    description: task.description,
    projectId: project.id,
    createdAt: project.createdAt,
    deadline: task.end || project.deadline,
    startAfter: task.start,
    importance: importanceOf(task),
    estimatedMinutes: Math.round(task.estimatedHours * 60),
    completedMinutes: Math.round(task.completedHours * 60),
    progress: Math.round(task.progress * 100),
    status: task.status === "todo" ? "ready" : task.status,
    actionable: true,
    dependencies: [...task.dependencies],
    source: project.source === "demo" ? "demo" : "legacy",
    createdByAI: project.source === "agent",
    completedAt: task.status === "done" ? task.end : undefined,
  }));
  return { projects: [migratedProject], tasks };
}

export function readLegacyStorage(storage: Pick<Storage, "getItem">): { projects: WaylineProject[]; tasks: WaylineTask[] } | null {
  try {
    const raw = storage.getItem("vd-workspace-v1");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { project?: LegacyProject | null } };
    return parsed.state?.project ? migrateLegacyProject(parsed.state.project) : null;
  } catch {
    return null;
  }
}
