"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { buildWaylineDemo } from "@/domain/demo";
import { materializeCapture } from "@/domain/capture";
import { readLegacyStorage } from "@/domain/migrations";
import { buildReview } from "@/domain/review";
import {
  WAYLINE_SCHEMA_VERSION,
  type Capture,
  type CaptureDraftInput,
  type CaptureResult,
  type Review,
  type ReviewRange,
  type TaskStatus,
  type WaylineProject,
  type WaylineSettings,
  type WaylineTask,
} from "@/domain/models";
import { getCaptureProvider, getPilotDeckProvider, recordPilotDeckMeta } from "@/lib/ai/provider";
import { MockCaptureProvider } from "@/lib/ai/mock";

const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

interface WaylineState {
  projects: WaylineProject[];
  tasks: WaylineTask[];
  captures: Capture[];
  reviews: Review[];
  settings: WaylineSettings;
  hydrated: boolean;
  analyzing: boolean;
  lastError: string | null;
  lastNotice: string | null;
  pendingCaptureId: string | null;
  bootstrap: () => void;
  analyzeCapture: (input: CaptureDraftInput) => Promise<void>;
  confirmCapture: (captureId: string) => void;
  cancelCapture: (captureId: string) => void;
  updateTask: (taskId: string, patch: Partial<Pick<WaylineTask, "title" | "description" | "importance" | "deadline" | "estimatedMinutes" | "completedMinutes" | "progress" | "status">>) => void;
  startTask: (taskId: string) => void;
  completeTask: (taskId: string) => void;
  generateReview: (range: ReviewRange, now?: number) => void;
  applyReviewSuggestion: (reviewId: string, suggestionId: string) => void;
  loadDemo: () => void;
}

function attachmentOf(input: CaptureDraftInput) {
  if (!input.media) return undefined;
  const bytes = new Uint8Array(input.media.bytes);
  let hash = 0;
  for (let index = 0; index < bytes.length; index += Math.max(1, Math.floor(bytes.length / 1024))) hash = ((hash << 5) - hash + bytes[index]) | 0;
  return { name: input.media.name, type: input.media.type, size: input.media.bytes.byteLength, fingerprint: (hash >>> 0).toString(16).padStart(8, "0") };
}

export const useWayline = create<WaylineState>()(persist((set, get) => ({
  projects: [],
  tasks: [],
  captures: [],
  reviews: [],
  settings: { schemaVersion: WAYLINE_SCHEMA_VERSION, dailyCapacityMinutes: 360 },
  hydrated: false,
  analyzing: false,
  lastError: null,
  lastNotice: null,
  pendingCaptureId: null,

  bootstrap: () => {
    if (get().hydrated) return;
    if (get().tasks.length || get().projects.length) {
      set({ hydrated: true });
      return;
    }
    const legacy = typeof window === "undefined" ? null : readLegacyStorage(window.localStorage);
    set({ ...(legacy ?? buildWaylineDemo()), hydrated: true });
  },

  analyzeCapture: async (input) => {
    if (get().analyzing) return;
    set({ analyzing: true, lastError: null, lastNotice: null });
    const started = Date.now();
    try {
      const provider = getCaptureProvider();
      let result: CaptureResult;
      let fallbackReason: string | undefined;
      try {
        result = await provider.understand(input);
        const pd = getPilotDeckProvider();
        const bridgeMeta = pd?.meta;
        if (provider.isMock) {
          fallbackReason = "?mock=1 forced";
        } else {
          recordPilotDeckMeta({
            provider: "PILOTDECK",
            model: bridgeMeta?.model ?? "pilotdeck-bridge",
            requestType: bridgeMeta?.requestType ?? (input.inputType === "image" ? "multimodal" : "text"),
            latencyMs: bridgeMeta?.latencyMs ?? Date.now() - started,
            retryCount: bridgeMeta?.retryCount ?? 0,
            fallback: false,
          });
        }
      } catch (pilotError) {
        // Real PilotDeck unavailable (timeout / key / network): record why,
        // then fall back to the local deterministic mock so the demo survives.
        const reason = pilotError instanceof Error ? pilotError.message : String(pilotError);
        fallbackReason = reason;
        const fallback = new MockCaptureProvider();
        result = await fallback.understand(input);
      }
      const bridgeMeta = getPilotDeckProvider()?.meta;
      recordPilotDeckMeta({ provider: fallbackReason ? "MOCK" : "PILOTDECK", model: fallbackReason ? "local-rules" : bridgeMeta?.model ?? "pilotdeck-bridge", requestType: input.inputType === "image" ? "multimodal" : "text", latencyMs: bridgeMeta?.latencyMs ?? Date.now() - started, retryCount: fallbackReason ? 0 : bridgeMeta?.retryCount ?? 0, fallback: Boolean(fallbackReason), fallbackReason, intent: result.intent, actionable: result.actionable, suggestedTaskCount: result.suggestedTasks.length });
      const id = makeId("capture");
      const capture: Capture = {
        id,
        createdAt: new Date().toISOString(),
        status: "pending",
        inputType: input.inputType,
        rawInput: input.text,
        attachment: attachmentOf(input),
        result,
      };
      set((state) => ({ captures: [...state.captures, capture], pendingCaptureId: id, analyzing: false, lastNotice: fallbackReason ? "PilotDeck 暂时不可用，已使用本地理解继续生成预览。" : null }));
    } catch (error) {
      set({ analyzing: false, lastError: error instanceof Error ? error.message : String(error) });
    }
  },

  confirmCapture: (captureId) => {
    const capture = get().captures.find((item) => item.id === captureId);
    if (!capture || capture.status !== "pending") return;
    const created = materializeCapture(capture, new Date().toISOString(), makeId);
    set((state) => ({
      projects: [...state.projects, ...created.projects],
      tasks: [...state.tasks, ...created.tasks],
      captures: state.captures.map((item) => item.id === captureId ? { ...item, status: "confirmed" as const } : item),
      pendingCaptureId: null,
    }));
  },

  cancelCapture: (captureId) => set((state) => ({
    captures: state.captures.map((capture) => capture.id === captureId ? { ...capture, status: "cancelled" as const } : capture),
    pendingCaptureId: null,
  })),

  updateTask: (taskId, patch) => set((state) => ({
    tasks: state.tasks.map((task) => {
      if (task.id !== taskId) return task;
      const progress = clamp(patch.progress ?? task.progress, 0, 100);
      const status = patch.status ?? (progress >= 100 ? "done" : task.status);
      return {
        ...task,
        ...patch,
        importance: clamp(Math.round(patch.importance ?? task.importance), 1, 10),
        progress: status === "done" ? 100 : progress,
        status,
        completedAt: status === "done" ? task.completedAt ?? new Date().toISOString() : undefined,
      };
    }),
  })),

  completeTask: (taskId) => get().updateTask(taskId, { status: "done", progress: 100 }),

  startTask: (taskId) => {
    const task = get().tasks.find((item) => item.id === taskId);
    if (!task || task.status === "in_progress" || task.status === "done" || task.status === "cancelled") return;
    get().updateTask(taskId, { status: "in_progress" });
  },

  generateReview: (range, now = Date.now()) => set((state) => {
    const review = buildReview(state.tasks, state.projects, range, now);
    const previous = state.reviews.find((item) => item.id === review.id);
    if (previous) {
      const statuses = new Map(previous.suggestions.map((suggestion) => [suggestion.id, suggestion.status]));
      review.suggestions = review.suggestions.map((suggestion) => ({ ...suggestion, status: statuses.get(suggestion.id) ?? suggestion.status }));
    }
    return { reviews: [...state.reviews.filter((item) => item.id !== review.id), review] };
  }),

  applyReviewSuggestion: (reviewId, suggestionId) => set((state) => {
    const review = state.reviews.find((item) => item.id === reviewId);
    const suggestion = review?.suggestions.find((item) => item.id === suggestionId);
    if (!review || !suggestion || suggestion.status !== "pending") return state;
    const tasks = suggestion.estimateMultiplier
      ? state.tasks.map((task) => task.status !== "done" && task.estimatedMinutes ? { ...task, estimatedMinutes: Math.round(task.estimatedMinutes * suggestion.estimateMultiplier!) } : task)
      : suggestion.projectId
        ? state.tasks.map((task) => task.projectId === suggestion.projectId && task.importance <= 5 && task.status === "ready" ? { ...task, status: "deferred" as TaskStatus } : task)
        : state.tasks;
    return {
      tasks,
      reviews: state.reviews.map((item) => item.id === reviewId ? { ...item, suggestions: item.suggestions.map((candidate) => candidate.id === suggestionId ? { ...candidate, status: "applied" as const } : candidate) } : item),
    };
  }),

  loadDemo: () => set({ ...buildWaylineDemo(), captures: [], reviews: [], pendingCaptureId: null, lastError: null, lastNotice: null }),
}), {
  name: "wayline-core-v2",
  version: WAYLINE_SCHEMA_VERSION,
  storage: createJSONStorage(() => localStorage),
  skipHydration: true,
  partialize: (state) => ({ projects: state.projects, tasks: state.tasks, captures: state.captures, reviews: state.reviews, settings: state.settings }),
}));
