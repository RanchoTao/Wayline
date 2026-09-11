export type TaskStatus =
  | "todo"
  | "in_progress"
  | "done"
  | "deferred"
  | "cancelled";

export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface Task {
  id: string;
  title: string;
  description?: string;
  /** ISO datetime */
  start: string;
  /** ISO datetime */
  end: string;
  estimatedHours: number;
  completedHours: number;
  /** 0..1 */
  progress: number;
  priority: TaskPriority;
  status: TaskStatus;
  dependencies: string[];
  isCritical: boolean;
}

export type MilestoneStatus = "reached" | "upcoming" | "at_risk";

export interface Milestone {
  id: string;
  title: string;
  at: string;
  status: MilestoneStatus;
}

export type ProjectSource = "demo" | "agent" | "imported";

export interface Project {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  deadline: string;
  /** effective working hours available in a full day (after sleep/class/etc.) */
  dailyCapacityHours: number;
  /** effective hours remaining *today* (can be tightened by constraints) */
  todayCapacityHours: number;
  tasks: Task[];
  milestones: Milestone[];
  riskScore: number;
  riskReason: string;
  status: "active" | "completed";
  source: ProjectSource;
  version: number;
}

export interface TaskChange {
  taskId: string;
  before: Partial<Task> | null;
  after: Partial<Task> | null;
}

export type AgentDecisionKind = "plan" | "replan";

export interface AgentDecision {
  id: string;
  createdAt: string;
  kind: AgentDecisionKind;
  reason: string;
  constraint?: string;
  explanation: string;
  changes: TaskChange[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  kind?: "goal" | "constraint" | "replan" | "system";
  text: string;
  createdAt: string;
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskInfo {
  score: number; // 0..1
  level: RiskLevel;
  reasons: string[];
  /** negative when behind schedule (hours) */
  scheduleGapHours: number;
  /** fraction 0..1 */
  expectedProgress: number;
  actualProgress: number;
  requiredHours: number;
  availableHours: number;
  capacityRatio: number;
  criticalIncomplete: number;
}

/** Structured plan emitted by the agent (mirrors spec section 6). */
export interface AgentResponse {
  project: {
    title: string;
    deadline: string;
    summary: string;
  };
  tasks: Array<{
    id: string;
    title: string;
    description?: string;
    start: string;
    end: string;
    estimatedHours: number;
    priority: TaskPriority;
    status: TaskStatus;
    dependencies: string[];
    isCritical: boolean;
  }>;
  milestones: Array<{
    id: string;
    title: string;
    at: string;
    status: MilestoneStatus;
  }>;
  risk: { score: number; level: string; reason: string };
  insight: {
    statusText: string;
    bottleneck: string;
    recommendedAction: string;
  };
  explanation: string;
}

/** Full outcome of a replan call, staged until APPLY PLAN is pressed. */
export interface ReplanResult {
  project: Project;
  decision: AgentDecision;
  explanation: string;
  changedTaskIds: string[];
  risk: RiskInfo;
  constraint: string;
}
