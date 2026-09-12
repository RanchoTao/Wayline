export const WAYLINE_SCHEMA_VERSION = 2;

export type CaptureInputType = "text" | "voice" | "image" | "document";
export type CaptureIntent = "task" | "project" | "note" | "event" | "unknown";
export type TaskSource = "manual" | "text" | "voice" | "image" | "document" | "ai" | "review" | "demo" | "legacy";
export type TaskStatus = "inbox" | "ready" | "in_progress" | "done" | "cancelled" | "deferred";
export type ProjectStatus = "active" | "completed" | "paused";

export interface WaylineProject {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  deadline?: string;
  importance: number;
  status: ProjectStatus;
  sourceCaptureId?: string;
}

export interface WaylineTask {
  id: string;
  title: string;
  description?: string;
  projectId?: string;
  parentTaskId?: string;
  createdAt: string;
  deadline?: string;
  startAfter?: string;
  importance: number;
  estimatedMinutes?: number;
  completedMinutes?: number;
  progress: number;
  status: TaskStatus;
  actionable: boolean;
  dependencies: string[];
  source: TaskSource;
  sourceCaptureId?: string;
  createdByAI: boolean;
  completedAt?: string;
}

export interface SuggestedTask {
  title: string;
  description?: string;
  importance: number;
  estimatedMinutes?: number;
  actionable: boolean;
  dependsOnIndexes?: number[];
}

export interface CaptureResult {
  rawInput: string;
  normalizedText: string;
  inputType: CaptureInputType;
  intent: CaptureIntent;
  title: string;
  description?: string;
  deadline?: string;
  importance?: number;
  estimatedDuration?: number;
  actionable: boolean;
  confidence: number;
  parentGoal?: string;
  suggestedTasks: SuggestedTask[];
  provider: string;
  warnings: string[];
}

export interface CaptureAttachment {
  name: string;
  type: string;
  size: number;
  fingerprint: string;
}

export interface Capture {
  id: string;
  createdAt: string;
  status: "pending" | "confirmed" | "cancelled" | "failed";
  inputType: CaptureInputType;
  rawInput: string;
  attachment?: CaptureAttachment;
  result: CaptureResult;
}

export type ReviewRange = "today" | "week" | "7d" | "30d";

export interface ReviewStatistics {
  plannedTasks: number;
  completedTasks: number;
  completionRate: number;
  deferredTasks: number;
  cancelledTasks: number;
  newTasks: number;
  biggestProgressProject?: string;
  mostDeferredProject?: string;
  estimateVarianceMinutes?: number;
}

export interface ReviewSuggestion {
  id: string;
  title: string;
  reason: string;
  projectId?: string;
  estimateMultiplier?: number;
  status: "pending" | "applied" | "dismissed";
}

export interface Review {
  id: string;
  range: ReviewRange;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  statistics: ReviewStatistics;
  facts: string[];
  patterns: string[];
  suggestions: ReviewSuggestion[];
  narrative: string;
}

export interface WaylineSettings {
  schemaVersion: number;
  dailyCapacityMinutes: number;
}

export interface CaptureMedia {
  name: string;
  type: string;
  bytes: ArrayBuffer;
}

export interface CaptureDraftInput {
  inputType: Exclude<CaptureInputType, "document">;
  text: string;
  media?: CaptureMedia;
}
