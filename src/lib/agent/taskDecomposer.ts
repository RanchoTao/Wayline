import type { TaskPriority } from "../types";
import type { GoalIntent } from "./goalParser";

export interface TaskTemplate {
  title: string;
  description: string;
  hours: number;
  priority: TaskPriority;
  deps: string[];
  critical: boolean;
  phase: "research" | "build" | "integrate" | "harden" | "deliver";
}

export type TemplateId = "hackathon" | "paper" | "exam" | "generic";

const HACKATHON: TaskTemplate[] = [
  {
    title: "Product Definition",
    description: "Define the one-line pitch, target user, demo story and scope boundaries.",
    hours: 4, priority: "high", deps: [], critical: true, phase: "research",
  },
  {
    title: "UI Prototype",
    description: "Figma / HTML prototype of the core screen and the key interaction flow.",
    hours: 8, priority: "high", deps: ["Product Definition"], critical: true, phase: "build",
  },
  {
    title: "Core Timeline",
    description: "Deadline timeline, countdown, progress vs time, schedule gap visualization.",
    hours: 9, priority: "high", deps: ["UI Prototype"], critical: true, phase: "build",
  },
  {
    title: "PilotDeck Integration",
    description: "Wire the agent adapter so goals become structured plans inside the app.",
    hours: 8, priority: "critical", deps: ["Core Timeline"], critical: true, phase: "integrate",
  },
  {
    title: "Risk Engine",
    description: "Deterministic risk scoring + agent insight panel with APPLY PLAN.",
    hours: 6, priority: "high", deps: ["Core Timeline"], critical: false, phase: "harden",
  },
  {
    title: "Testing",
    description: "Walk the full demo flow, fix console errors, verify persistence and build.",
    hours: 4, priority: "high", deps: ["PilotDeck Integration"], critical: true, phase: "harden",
  },
  {
    title: "Demo Video",
    description: "Record a 3-minute story: vague goal -> plan -> constraint -> replan.",
    hours: 3, priority: "high", deps: ["Testing"], critical: true, phase: "deliver",
  },
  {
    title: "Presentation",
    description: "Pitch deck: problem, insight, agent loop, live demo, ask.",
    hours: 3, priority: "medium", deps: ["Demo Video"], critical: false, phase: "deliver",
  },
  {
    title: "Landing Page",
    description: "Marketing page for the product. Nice-to-have, non-critical.",
    hours: 4, priority: "low", deps: ["UI Prototype"], critical: false, phase: "build",
  },
  {
    title: "Visual Polish",
    description: "Animations, micro-interactions and edge-case styling.",
    hours: 3, priority: "low", deps: ["Core Timeline"], critical: false, phase: "harden",
  },
];

const PAPER: TaskTemplate[] = [
  { title: "Related Work", description: "Survey 10-15 relevant papers and position the gap.", hours: 6, priority: "high", deps: [], critical: true, phase: "research" },
  { title: "Problem Statement", description: "Formalize the research question and success metric.", hours: 3, priority: "high", deps: ["Related Work"], critical: true, phase: "research" },
  { title: "Method Design", description: "Define approach, architecture and baselines.", hours: 8, priority: "high", deps: ["Problem Statement"], critical: true, phase: "build" },
  { title: "Implementation", description: "Build the system and instrument experiments.", hours: 12, priority: "critical", deps: ["Method Design"], critical: true, phase: "build" },
  { title: "Experiments", description: "Run baselines and ablations, collect results.", hours: 10, priority: "high", deps: ["Implementation"], critical: true, phase: "harden" },
  { title: "Analysis", description: "Tables, figures, error analysis, limitations.", hours: 6, priority: "medium", deps: ["Experiments"], critical: false, phase: "harden" },
  { title: "Write Up", description: "Draft full paper, revise with advisor feedback.", hours: 10, priority: "high", deps: ["Analysis"], critical: true, phase: "deliver" },
  { title: "Final Submission", description: "Format, proofread, submit to venue.", hours: 3, priority: "high", deps: ["Write Up"], critical: true, phase: "deliver" },
];

const EXAM: TaskTemplate[] = [
  { title: "Syllabus Scan", description: "List topics, weights and past papers coverage.", hours: 2, priority: "high", deps: [], critical: true, phase: "research" },
  { title: "Concept Notes", description: "Condensed notes per topic with formula sheets.", hours: 6, priority: "high", deps: ["Syllabus Scan"], critical: true, phase: "build" },
  { title: "Problem Sets", description: "50 representative problems, worked in full.", hours: 10, priority: "high", deps: ["Concept Notes"], critical: true, phase: "build" },
  { title: "Mock Exams", description: "3 timed mock exams under exam conditions.", hours: 8, priority: "critical", deps: ["Problem Sets"], critical: true, phase: "harden" },
  { title: "Error Review", description: "Categorize mistakes, re-drill weak topics.", hours: 5, priority: "high", deps: ["Mock Exams"], critical: false, phase: "harden" },
  { title: "Final Pass", description: "One full pass over formula sheet + weak topics.", hours: 3, priority: "medium", deps: ["Error Review"], critical: false, phase: "deliver" },
];

const GENERIC: TaskTemplate[] = [
  { title: "Define Scope", description: "Clarify the outcome, quality bar and what is out of scope.", hours: 2, priority: "high", deps: [], critical: true, phase: "research" },
  { title: "Research & Gather", description: "Collect inputs, references and constraints.", hours: 4, priority: "high", deps: ["Define Scope"], critical: true, phase: "research" },
  { title: "Draft Core", description: "Produce the main deliverable in its rough form.", hours: 10, priority: "critical", deps: ["Research & Gather"], critical: true, phase: "build" },
  { title: "Review & Iterate", description: "Feedback loop and revisions.", hours: 6, priority: "high", deps: ["Draft Core"], critical: true, phase: "harden" },
  { title: "Finalize", description: "Polish, proofread, package the deliverable.", hours: 4, priority: "high", deps: ["Review & Iterate"], critical: true, phase: "deliver" },
];

const TEMPLATES: Record<TemplateId, TaskTemplate[]> = {
  hackathon: HACKATHON,
  paper: PAPER,
  exam: EXAM,
  generic: GENERIC,
};

export function templateForIntent(intent: GoalIntent): TemplateId {
  switch (intent) {
    case "hackathon": return "hackathon";
    case "paper": return "paper";
    case "exam": return "exam";
    default: return "generic";
  }
}

export function getTemplate(id: TemplateId): TaskTemplate[] {
  return TEMPLATES[id];
}
