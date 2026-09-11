import type { Project, Task, TaskPriority, TaskStatus } from "../types";
import { DAY_MS, toIso, uid } from "../time";
import { computeMetrics, computeRisk } from "../metrics";
import { scheduleTasks } from "../agent/scheduler";
import { buildInsight, findBottleneck } from "../agent/riskAnalyzer";
import { buildMilestones } from "../agent/pipeline";

interface DemoTaskSpec {
  title: string;
  description: string;
  hours: number;
  done: number; // completed hours
  status: TaskStatus;
  priority: TaskPriority;
  deps: string[];
  critical: boolean;
}

/**
 * Built relative to `now` so that at load time:
 *   TIME USED  = 65%   (elapsed / total window)
 *   WORK DONE  = 42%   (done hours / total hours — nudged exactly)
 * The story: 60%+ of the time is gone, only ~42% of the work is done,
 * and the critical PilotDeck Integration has not started → BEHIND SCHEDULE.
 */
export function buildHackathonDemo(now = Date.now()): Project {
  const TOTAL_DAYS = 10;
  const USED_FRAC = 0.65;
  const WORK_DONE_TARGET = 0.42;
  const DAILY = 5;

  const totalMs = TOTAL_DAYS * DAY_MS;
  const createdAt = now - totalMs * USED_FRAC;
  const deadline = createdAt + totalMs;

  const specs: DemoTaskSpec[] = [
    {
      title: "Product Definition",
      description: "Pitch, scope and demo story locked with the team.",
      hours: 4, done: 4, status: "done", priority: "high", deps: [], critical: true,
    },
    {
      title: "UI Prototype",
      description: "Core screen + key interaction flow prototyped.",
      hours: 8, done: 6, status: "in_progress", priority: "high",
      deps: ["t_product_definition"], critical: true,
    },
    {
      title: "Core Timeline",
      description: "Deadline timeline, countdown, progress vs time visualization.",
      hours: 8, done: 6, status: "in_progress", priority: "high",
      deps: ["t_ui_prototype"], critical: true,
    },
    {
      title: "PilotDeck Integration",
      description: "Agent adapter: goals become structured plans inside the app.",
      hours: 8, done: 0, status: "todo", priority: "high",
      deps: ["t_core_timeline"], critical: true,
    },
    {
      title: "Risk Engine",
      description: "Deterministic risk scoring + agent insight panel.",
      hours: 6, done: 4, status: "in_progress", priority: "high",
      deps: ["t_core_timeline"], critical: false,
    },
    {
      title: "Testing",
      description: "Full demo walk, console fixes, persistence + build check.",
      hours: 4, done: 0, status: "todo", priority: "high",
      deps: ["t_pilotdeck_integration"], critical: true,
    },
    {
      title: "Demo Video",
      description: "3-minute story: vague goal → plan → constraint → replan.",
      hours: 3, done: 0, status: "todo", priority: "high",
      deps: ["t_testing"], critical: true,
    },
    {
      title: "Presentation",
      description: "Pitch deck for the judges.",
      hours: 2, done: 0, status: "todo", priority: "medium",
      deps: ["t_demo_video"], critical: false,
    },
    {
      title: "Landing Page",
      description: "Marketing page. Nice-to-have, non-critical.",
      hours: 2, done: 0, status: "todo", priority: "low",
      deps: ["t_ui_prototype"], critical: false,
    },
    {
      title: "Visual Polish",
      description: "Animations and micro-interactions. Non-critical.",
      hours: 3, done: 0, status: "todo", priority: "low",
      deps: ["t_core_timeline"], critical: false,
    },
  ];

  let tasks: Task[] = specs.map((s) => ({
    id: `t_${slug(s.title)}`,
    title: s.title,
    description: s.description,
    start: "",
    end: "",
    estimatedHours: s.hours,
    completedHours: s.done,
    progress: s.hours > 0 ? s.done / s.hours : 0,
    priority: s.priority,
    status: s.status,
    dependencies: s.deps,
    isCritical: s.critical,
  }));

  // nudge Visual Polish so WORK DONE reads exactly 42% at load
  const doneHours = tasks.reduce((s, t) => s + t.completedHours, 0);
  const othersTotal = tasks
    .filter((t) => t.title !== "Visual Polish")
    .reduce((s, t) => s + t.estimatedHours, 0);
  tasks = tasks.map((t) =>
    t.title === "Visual Polish"
      ? {
          ...t,
          estimatedHours: Math.max(1, doneHours / WORK_DONE_TARGET - othersTotal),
        }
      : t
  );

  const scheduled = scheduleTasks(
    tasks,
    toIso(createdAt),
    toIso(deadline),
    DAILY,
    DAILY,
    now
  );

  const project: Project = {
    id: uid("proj"),
    title: "Hi Youth Hackathon — VisualDeadline Agent",
    description:
      "Agent-native deadline cockpit for the Hi Youth hackerthon. 10 days from idea to demo day.",
    createdAt: toIso(createdAt),
    deadline: toIso(deadline),
    dailyCapacityHours: DAILY,
    todayCapacityHours: DAILY,
    tasks: scheduled.tasks,
    milestones: [],
    riskScore: 0,
    riskReason: "",
    status: "active",
    source: "demo",
    version: 1,
  };

  project.milestones = buildMilestones(project, now);
  const risk = computeRisk(project, now);
  project.riskScore = risk.score;
  project.riskReason = risk.reasons.join(" · ");

  return project;
}

function slug(s: string): string {
  return s.replace(/[^a-z0-9]/gi, "_").toLowerCase();
}

export function demoInsight(project: Project, now = Date.now()) {
  const risk = computeRisk(project, now);
  const insight = buildInsight(project, now, risk);
  const bottleneck = findBottleneck(project);
  const m = computeMetrics(project, now);
  return { risk, insight, bottleneck, metrics: m };
}

export { buildMilestones };
