import type { AgentResponse, ReplanResult } from "../types";
import type { AgentProvider } from "./types";

/**
 * Real PilotDeck SDK client.
 *
 * NOT YET ACTIVE — the PilotDeck SDK is not present in this repository
 * (no node_modules package, no documented API surface). The seam is kept
 * so wiring it up later is a drop-in change:
 *
 *   1. `npm install <pilotdeck-sdk>`
 *   2. set PILOTDECK_API_KEY (or other auth) in .env.local
 *   3. replace the bodies of the three methods below with the real calls
 *   4. flip getAgentProvider() to return PilotDeckAgentProvider
 *
 * UI and agent pipeline are unaffected: they only see AgentProvider.
 */
export class PilotDeckAgentProvider implements AgentProvider {
  readonly name = "PILOTDECK";
  readonly isMock = false;

  private notReady(): never {
    throw new Error(
      "PilotDeckAgentProvider is not configured. " +
        "The PilotDeck SDK is not available in this repository yet — " +
        "the app runs on MockAgentProvider instead (see provider.ts)."
    );
  }

  async generatePlan(): Promise<AgentResponse> {
    this.notReady();
  }

  async replan(): Promise<ReplanResult> {
    this.notReady();
  }

  explain(): string[] {
    return ["PilotDeck agent (not connected)"];
  }
}
