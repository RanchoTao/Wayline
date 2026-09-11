"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AgentDecision,
  ChatMessage,
  Project,
  ReplanResult,
  TaskStatus,
} from "@/lib/types";
import { nowIso, uid } from "@/lib/time";
import { computeRisk } from "@/lib/metrics";
import { getAgentProvider } from "@/lib/pilotdeck/provider";
import { projectFromResponse } from "@/lib/agent/pipeline";
import { buildHackathonDemo } from "@/lib/demo/hackathon";
import { scheduleTasks } from "@/lib/agent/scheduler";

function refreshRisk(p: Project, now = Date.now()): Project {
  const risk = computeRisk(p, now);
  return { ...p, riskScore: risk.score, riskReason: risk.reasons.join(" · ") };
}

export interface WorkspaceState {
  project: Project | null;
  decisions: AgentDecision[];
  conversation: ChatMessage[];
  pendingPlan: ReplanResult | null;
  thinking: boolean;
  lastError: string | null;
  changedTaskIds: string[];

  loadDemo: () => void;
  reset: () => void;
  generateFromGoal: (goal: string, deadline?: string | null) => Promise<void>;
  sendConstraint: (constraint: string) => Promise<void>;
  applyPendingPlan: () => void;
  discardPendingPlan: () => void;
  setTaskProgress: (taskId: string, progress: number) => void;
  setTaskStatus: (taskId: string, status: TaskStatus) => void;
  setTaskTitle: (taskId: string, title: string) => void;
  setDeadline: (deadlineIso: string) => void;
  exportJson: () => string;
  importJson: (json: string) => boolean;
  clearChanged: () => void;
}

export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      project: null,
      decisions: [],
      conversation: [],
      pendingPlan: null,
      thinking: false,
      lastError: null,
      changedTaskIds: [],

      loadDemo: () => {
        const project = buildHackathonDemo();
        const now = nowIso();
        set({
          project,
          decisions: [],
          pendingPlan: null,
          thinking: false,
          lastError: null,
          changedTaskIds: project.tasks.map((t) => t.id),
          conversation: [
            {
              id: uid("msg"),
              role: "agent",
              kind: "system",
              text:
                "Hackathon demo loaded. 10 days, 10 tasks, 65% of the time gone, 42% of the work done.\n" +
                "Agent reads this as BEHIND SCHEDULE. Tell it a constraint — e.g. \"I only have 3 hours today\".",
              createdAt: now,
            },
          ],
        });
        setTimeout(() => get().clearChanged(), 6000);
      },

      reset: () => {
        set({
          project: null,
          decisions: [],
          conversation: [],
          pendingPlan: null,
          thinking: false,
          lastError: null,
          changedTaskIds: [],
        });
      },

      generateFromGoal: async (goal, deadline) => {
        const trimmed = goal.trim();
        if (!trimmed) return;
        const provider = getAgentProvider();
        const userMsg: ChatMessage = {
          id: uid("msg"),
          role: "user",
          kind: "goal",
          text: trimmed,
          createdAt: nowIso(),
        };
        set((s) => ({
          thinking: true,
          lastError: null,
          conversation: [...s.conversation, userMsg],
        }));
        try {
          const resp = await provider.generatePlan({
            goal: trimmed,
            deadline: deadline ?? null,
            now: Date.now(),
          });
          const project = projectFromResponse(resp, trimmed, Date.now());
          const agentMsg: ChatMessage = {
            id: uid("msg"),
            role: "agent",
            kind: "goal",
            text:
              `Plan ready — ${project.tasks.filter((t) => t.status !== "done").length} tasks to the deadline.\n` +
              provider.explain(resp).join("\n"),
            createdAt: nowIso(),
          };
          set((s) => ({
            project,
            thinking: false,
            conversation: [...s.conversation, agentMsg],
            pendingPlan: null,
            changedTaskIds: project.tasks.map((t) => t.id),
          }));
          setTimeout(() => get().clearChanged(), 6000);
        } catch (e) {
          set({
            thinking: false,
            lastError: e instanceof Error ? e.message : String(e),
          });
        }
      },

      sendConstraint: async (constraint) => {
        const { project, conversation } = get();
        const trimmed = constraint.trim();
        if (!project || !trimmed) return;
        const provider = getAgentProvider();
        const userMsg: ChatMessage = {
          id: uid("msg"),
          role: "user",
          kind: "constraint",
          text: trimmed,
          createdAt: nowIso(),
        };
        set({ thinking: true, lastError: null, conversation: [...conversation, userMsg] });
        try {
          const result = await provider.replan({
            project,
            constraint: trimmed,
            now: Date.now(),
          });
          const agentMsg: ChatMessage = {
            id: uid("msg"),
            role: "agent",
            kind: "replan",
            text:
              `Replan ready (${result.changedTaskIds.length} tasks affected).\n` +
              provider.explain(result).join("\n"),
            createdAt: nowIso(),
          };
          set((s) => ({
            thinking: false,
            pendingPlan: result,
            conversation: [...s.conversation, agentMsg],
          }));
        } catch (e) {
          set({
            thinking: false,
            lastError: e instanceof Error ? e.message : String(e),
          });
        }
      },

      applyPendingPlan: () => {
        const { pendingPlan, decisions } = get();
        if (!pendingPlan) return;
        const agentMsg: ChatMessage = {
          id: uid("msg"),
          role: "agent",
          kind: "system",
          text: `PLAN APPLIED — timeline, priorities and risk updated. Risk ${pendingPlan.decision.kind === "replan" ? "recomputed" : "unchanged"}.`,
          createdAt: nowIso(),
        };
        set((s) => ({
          project: pendingPlan.project,
          decisions: [...decisions, pendingPlan.decision],
          pendingPlan: null,
          changedTaskIds: pendingPlan.changedTaskIds,
          conversation: [...s.conversation, agentMsg],
        }));
        setTimeout(() => get().clearChanged(), 8000);
      },

      discardPendingPlan: () => set({ pendingPlan: null }),

      setTaskProgress: (taskId, progress) => {
        const { project } = get();
        if (!project) return;
        const p = Math.max(0, Math.min(1, progress));
        const tasks = project.tasks.map((t) => {
          if (t.id !== taskId) return t;
          const completedHours = Math.round(t.estimatedHours * p * 10) / 10;
          return {
            ...t,
            progress: p,
            completedHours,
            status: (p >= 1 ? "done" : p > 0 ? "in_progress" : "todo") as TaskStatus,
          };
        });
        set({ project: refreshRisk({ ...project, tasks }) });
      },

      setTaskStatus: (taskId, status) => {
        const { project } = get();
        if (!project) return;
        const tasks = project.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status,
                progress: status === "done" ? 1 : t.progress,
                completedHours:
                  status === "done" ? t.estimatedHours : t.completedHours,
              }
            : t
        );
        set({ project: refreshRisk({ ...project, tasks }) });
      },

      setTaskTitle: (taskId, title) => {
        const { project } = get();
        if (!project) return;
        const tasks = project.tasks.map((t) =>
          t.id === taskId ? { ...t, title } : t
        );
        set({ project: { ...project, tasks } });
      },

      setDeadline: (deadlineIso) => {
        const { project } = get();
        if (!project) return;
        const rescheduled = scheduleTasks(
          project.tasks,
          project.createdAt,
          deadlineIso,
          project.dailyCapacityHours,
          project.todayCapacityHours,
          Date.now()
        );
        set({
          project: refreshRisk({
            ...project,
            deadline: deadlineIso,
            tasks: rescheduled.tasks,
          }),
        });
      },

      exportJson: () => {
        const { project, decisions } = get();
        return JSON.stringify(
          { app: "visualdeadline-agent", version: 1, project, decisions },
          null,
          2
        );
      },

      importJson: (json) => {
        try {
          const data = JSON.parse(json) as {
            project?: Project;
            decisions?: AgentDecision[];
          };
          if (!data.project) return false;
          set({
            project: refreshRisk(data.project),
            decisions: data.decisions ?? [],
            pendingPlan: null,
            changedTaskIds: data.project.tasks.map((t) => t.id),
          });
          return true;
        } catch {
          return false;
        }
      },

      clearChanged: () => set({ changedTaskIds: [] }),
    }),
    {
      name: "vd-workspace-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        project: s.project,
        decisions: s.decisions,
        conversation: s.conversation,
      }),
    }
  )
);
