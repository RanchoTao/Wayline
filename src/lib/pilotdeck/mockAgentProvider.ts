import { generatePlan, replanProject } from "../agent/pipeline";
import type { AgentResponse, Project, ReplanResult } from "../types";
import { parseConstraint } from "../agent/replanner";
import type { AgentProvider } from "./types";

/**
 * Deterministic agent that runs entirely in the browser.
 * It is NOT fixed text: it parses the goal, decomposes by intent,
 * schedules against the deadline, scores risk, and re-plans from
 * constraints — see src/lib/agent/*.
 *
 * Swapped out for PilotDeckAgentProvider once the SDK is available;
 * the product can't tell the difference.
 */
export class MockAgentProvider implements AgentProvider {
  readonly name = "MOCK AGENT";
  readonly isMock = true;

  async generatePlan(input: {
    goal: string;
    deadline?: string | null;
    now?: number;
  }): Promise<AgentResponse> {
    // small latency so the UI can show the thinking state
    await delay(500);
    return generatePlan(input.goal, {
      deadline: input.deadline,
      now: input.now,
    }).response;
  }

  async replan(input: {
    project: Project;
    constraint: string;
    now?: number;
  }): Promise<ReplanResult> {
    await delay(600);
    return replanProject(input.project, input.constraint, input.now);
  }

  explain(result: AgentResponse | ReplanResult): string[] {
    if ("explanation" in result && "decision" in result) {
      const lines = result.explanation.split("\n").filter(Boolean);
      const parsed = parseConstraint(result.constraint);
      if (parsed.todayCapacityHours !== undefined) {
        return [
          `Constraint detected: "${result.constraint}"`,
          `Available time today → ${parsed.todayCapacityHours}h`,
          ...lines,
        ];
      }
      return lines;
    }
    return [result.explanation, ...result.tasks.map((t) => `→ ${t.title} (${t.estimatedHours}h)`).slice(0, 3)];
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
