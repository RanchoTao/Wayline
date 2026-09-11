import { PilotDeckAgentProvider } from "./pilotdeckClient";
import { MockAgentProvider } from "./mockAgentProvider";
import type { AgentProvider } from "./types";

let provider: AgentProvider | null = null;

const SDK_AVAILABLE = false; // flip to true when the PilotDeck SDK ships

/**
 * Single access point for the agent.
 *
 * The env-gate lives here so the rest of the app can do
 * `getAgentProvider().generatePlan(...)` without caring which
 * implementation is live.
 */
export function getAgentProvider(): AgentProvider {
  if (!provider) {
    provider = SDK_AVAILABLE ? new PilotDeckAgentProvider() : new MockAgentProvider();
  }
  return provider;
}

export function isMockAgent(): boolean {
  return getAgentProvider().isMock;
}

export { MockAgentProvider, PilotDeckAgentProvider };
export type { AgentProvider };
