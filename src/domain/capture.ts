import type { Capture, WaylineProject, WaylineTask } from "./models";

export function materializeCapture(
  capture: Capture,
  now: string,
  idFactory: (prefix: string) => string,
): { projects: WaylineProject[]; tasks: WaylineTask[] } {
  const projectId = capture.result.actionable ? undefined : idFactory("project");
  const parentTaskId = capture.result.actionable ? undefined : idFactory("parent");
  const projects: WaylineProject[] = projectId ? [{
    id: projectId,
    title: capture.result.title,
    description: capture.result.description,
    createdAt: now,
    deadline: capture.result.deadline,
    importance: capture.result.importance ?? 7,
    status: "active",
    sourceCaptureId: capture.id,
  }] : [];
  const parent: WaylineTask[] = parentTaskId ? [{
    id: parentTaskId,
    title: capture.result.title,
    description: capture.result.description,
    projectId,
    createdAt: now,
    deadline: capture.result.deadline,
    importance: capture.result.importance ?? 7,
    progress: 0,
    status: "ready",
    actionable: false,
    dependencies: [],
    source: capture.inputType,
    sourceCaptureId: capture.id,
    createdByAI: true,
  }] : [];
  const ids = capture.result.suggestedTasks.map(() => idFactory("task"));
  const children = capture.result.suggestedTasks.map((suggestion, index): WaylineTask => ({
    id: ids[index],
    title: suggestion.title,
    description: suggestion.description,
    projectId,
    parentTaskId,
    createdAt: now,
    deadline: capture.result.deadline,
    importance: suggestion.importance,
    estimatedMinutes: suggestion.estimatedMinutes,
    completedMinutes: 0,
    progress: 0,
    status: "ready",
    actionable: suggestion.actionable,
    dependencies: (suggestion.dependsOnIndexes ?? []).map((dependencyIndex) => ids[dependencyIndex]).filter(Boolean),
    source: capture.result.actionable ? capture.inputType : "ai",
    sourceCaptureId: capture.id,
    createdByAI: !capture.result.actionable,
  }));
  // A directly actionable capture (no decomposition) becomes exactly ONE task.
  const directTask: WaylineTask[] = capture.result.actionable && capture.result.suggestedTasks.length === 0 ? [{
    id: idFactory("task"),
    title: capture.result.title,
    description: capture.result.description,
    projectId: undefined,
    parentTaskId: undefined,
    createdAt: now,
    deadline: capture.result.deadline,
    importance: capture.result.importance ?? 7,
    estimatedMinutes: capture.result.estimatedDuration,
    completedMinutes: 0,
    progress: 0,
    status: "ready",
    actionable: true,
    dependencies: [],
    source: capture.inputType,
    sourceCaptureId: capture.id,
    createdByAI: false,
  }] : [];
  return { projects, tasks: [...parent, ...children, ...directTask] };
}
