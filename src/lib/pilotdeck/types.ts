import type { AgentResponse, Project, ReplanResult } from "../types";

/**
 * The seam between the product and any Agent runtime.
 *
 * VisualDeadline Agent talks to "the agent" ONLY through this interface.
 * - MockAgentProvider      → fully deterministic, works with zero config
 * - PilotDeckAgentProvider → real PilotDeck SDK, wired when the SDK lands
 *
 * UI and agent pipeline (src/lib/agent/*) never import providers directly;
 * they always go through getAgentProvider() (see provider.ts).
 */
export interface AgentProvider {
  readonly name: string;
  readonly isMock: boolean;

  /** Vague goal + optional deadline → structured, UI-ready plan. */
  generatePlan(input: {
    goal: string;
    deadline?: string | null;
    now?: number;
  }): Promise<AgentResponse>;

  /** Current project + constraint text → staged replan (APPLY PLAN applies it). */
  replan(input: { project: Project; constraint: string; now?: number }): Promise<ReplanResult>;

  /** Human-readable trace of what the agent did (for the AGENT panel). */
  explain(result: AgentResponse | ReplanResult): string[];
}
