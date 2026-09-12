import { MockCaptureProvider } from "./mock";
import { PilotDeckCaptureProvider, type PilotDeckMeta } from "./pilotdeck";
import type { CaptureProvider } from "./types";

let pilotdeckProvider: PilotDeckCaptureProvider | undefined;
let mockProvider: MockCaptureProvider | undefined;
let lastMeta: PilotDeckMeta | undefined;

/**
 * Provider selection: real PilotDeck first (server-side bridge), local
 * deterministic Mock as fallback so the demo never dies on API failure.
 */
export function getCaptureProvider(): CaptureProvider {
  // Prefer real PilotDeck unless explicitly disabled for offline demos.
  if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("mock")) {
    mockProvider ??= new MockCaptureProvider();
    return mockProvider;
  }
  pilotdeckProvider ??= new PilotDeckCaptureProvider();
  return pilotdeckProvider;
}

export function getPilotDeckProvider(): PilotDeckCaptureProvider | undefined {
  pilotdeckProvider ??= new PilotDeckCaptureProvider();
  return pilotdeckProvider;
}

/** Debug aid: record the outcome of the latest AI call (provider, latency, model, fallback reason). */
export function recordPilotDeckMeta(meta: PilotDeckMeta): void {
  lastMeta = meta;
}

export function getLastPilotDeckMeta(): PilotDeckMeta | undefined {
  return lastMeta;
}

export function getProviderInfo() {
  return {
    primary: "PILOTDECK",
    fallback: "MOCK",
    mode: typeof window !== "undefined" && new URLSearchParams(window.location.search).has("mock") ? "mock" : "pilotdeck",
  };
}

export type { CaptureProvider } from "./types";
