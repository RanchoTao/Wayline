import type { CaptureResult } from "@/domain/models";
import type { CaptureProvider } from "./types";

export class PilotDeckCaptureProvider implements CaptureProvider {
  readonly name = "PILOTDECK";
  readonly isMock = false;
  readonly capabilities = { text: true, voiceTranscript: true, imageUnderstanding: "native" as const };

  async understand(): Promise<CaptureResult> {
    throw new Error("PilotDeck multimodal API is not documented or installed in this repository. The local provider remains active.");
  }
}
