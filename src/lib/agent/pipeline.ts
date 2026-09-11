import type {
  AgentDecision,
  AgentResponse,
  Milestone,
  Project,
  ReplanResult,
  Task,
  TaskPriority,
} from "../types";
import { addHours, nowIso, parseIso, toIso, uid } from "../time";
import { computeRisk } from "../metrics";
import { buildInsight } from "./riskAnalyzer";
import { getTemplate, templateForIntent, type TaskTemplate } from "./taskDecomposer";
import { parseGoal, type ParsedGoal } from "./goalParser";
import { scheduleTasks } from "./scheduler";
import { replanProject } from "./replanner";

export interface GeneratePlanOptions {
  deadline?: string | null;
  dailyCapacityHours?: number;
  todayCapacityHours?: number;
  now?: number;
}

const DEFAULT_DAILY = 6;

function priorityOf(t: TaskTemplate): TaskPriority {
  return t.priority;
}

function tasksFromTemplate(
  template: TaskTemplate[]
): Task[] {
  const idOf = (title: string) => `t_${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`;
  return template.map((tpl) => ({
    id: idOf(tpl.title),
    title: tpl.title,
    description: tpl.description,
    start: "",
    end: "",
    estimatedHours: tpl.hours,
    completedHours: 0,
    progress: 0,
    priority: priorityOf(tpl),
    status: "todo" as const,
    dependencies: tpl.deps.map((d) => idOf(d)),
    isCritical: tpl.critical,
  }));
}

function milestoneOf(
  id: string,
  title: string,
  atIso: string,
  project: Project,
  now: number
): Milestone {
  const criticalOpen = project.tasks.some(
    (t) => t.isCritical && t.status !== "done"
  );
  const reached = parseIso(atIso) <= now;
  return {
    id,
    title,
    at: atIso,
    status: reached ? "reached" : criticalOpen ? "at_risk" : "upcoming",
  };
}

export interface PlanResult {
  project: Project;
  response: AgentResponse;
  decision: AgentDecision;
}

/** Goal → decompose → schedule → risk → insight (spec core Agent Loop). */
export function generatePlan(
  goalText: string,
  options: GeneratePlanOptions = {}
): PlanResult {
  const now = options.now ?? Date.now();
  const parsed: ParsedGoal = parseGoal(goalText, now);

  const deadline =
    options.deadline ?? parsed.deadlineIso ?? addHours(toIso(now), 7 * 24);
  const dailyCapacity = options.dailyCapacityHours ?? DEFAULT_DAILY;
  const todayCapacity = options.todayCapacityHours ?? DEFAULT_DAILY;

  const template = getTemplate(templateForIntent(parsed.intent));
  const tasks = tasksFromTemplate(template);

  const scheduled = scheduleTasks(
    tasks,
    toIso(now),
    deadline,
    dailyCapacity,
    todayCapacity,
    now
  );

  const project: Project = {
    id: uid("proj"),
    title: parsed.title,
    description: parsed.summary,
    createdAt: toIso(now),
    deadline,
    dailyCapacityHours: dailyCapacity,
    todayCapacityHours: todayCapacity,
    tasks: scheduled.tasks,
    milestones: [],
    riskScore: 0,
    riskReason: "",
    status: "active",
    source: "agent",
    version: 1,
  };

  project.milestones = buildMilestones(project, now);

  const risk = computeRisk(project, now);
  project.riskScore = risk.score;
  project.riskReason = risk.reasons.join(" · ");
  const insight = buildInsight(project, now, risk);

  const response: AgentResponse = {
    project: {
      title: project.title,
      deadline: project.deadline,
      summary: parsed.summary,
    },
    tasks: project.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      start: t.start,
      end: t.end,
      estimatedHours: t.estimatedHours,
      priority: t.priority,
      status: t.status,
      dependencies: t.dependencies,
      isCritical: t.isCritical,
    })),
    milestones: project.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      at: m.at,
      status: m.status,
    })),
    risk: {
      score: risk.score,
      level: risk.level,
      reason: risk.reasons.join(" · "),
    },
    insight: {
      statusText: insight.statusText,
      bottleneck: insight.bottleneck,
      recommendedAction: insight.recommendedAction,
    },
    explanation: parsed.deadlineIso
      ? `Deadline extracted from your goal: ${new Date(
          parsed.deadlineIso
        ).toLocaleString()}.`
      : `No explicit deadline found — assumed 7 days out. You can change it in the top bar.`,
  };

  const decision: AgentDecision = {
    id: uid("dec"),
    createdAt: nowIso(),
    kind: "plan",
    reason: goalText.trim(),
    explanation: response.explanation,
    changes: [],
  };

  return { project, response, decision };
}

export function buildMilestones(project: Project, now: number): Milestone[] {
  const criticalTasks = project.tasks
    .filter((t) => t.isCritical && t.status !== "done")
    .sort((a, b) => a.start.localeCompare(b.start));

  const ms: Milestone[] = [
    milestoneOf("ms_plan", "Plan locked", project.createdAt, project, now),
  ];
  if (criticalTasks.length > 1) {
    ms.push(
      milestoneOf(
        "ms_mid",
        `${criticalTasks[0].title} done`,
        criticalTasks[0].end,
        project,
        now
      )
    );
  }
  const last = criticalTasks[criticalTasks.length - 1];
  if (last) {
    ms.push(
      milestoneOf("ms_core", `${last.title} done`, last.end, project, now)
    );
  }
  ms.push(
    milestoneOf(
      "ms_ready",
      "Ready for deadline",
      toIso(parseIso(project.deadline) - 6 * 3600_000),
      project,
      now
    )
  );
  return ms;
}

export { replanProject };

/** Rebuild a full Project from a structured AgentResponse (adapter boundary). */
export function projectFromResponse(
  resp: AgentResponse,
  goalText: string,
  now = Date.now()
): Project {
  const project: Project = {
    id: uid("proj"),
    title: resp.project.title,
    description: resp.project.summary,
    createdAt: toIso(now),
    deadline: resp.project.deadline,
    dailyCapacityHours: 6,
    todayCapacityHours: 6,
    tasks: resp.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      start: t.start,
      end: t.end,
      estimatedHours: t.estimatedHours,
      completedHours: t.status === "done" ? t.estimatedHours : 0,
      progress: t.status === "done" ? 1 : 0,
      priority: t.priority,
      status: t.status,
      dependencies: t.dependencies,
      isCritical: t.isCritical,
    })),
    milestones: resp.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      at: m.at,
      status: m.status,
    })),
    riskScore: resp.risk.score,
    riskReason: resp.risk.reason,
    status: "active",
    source: "agent",
    version: 1,
  };
  return project;
}

export type { ReplanResult };
