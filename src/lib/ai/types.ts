import type { CaptureDraftInput, CaptureResult } from "@/domain/models";

export interface CaptureProvider {
  readonly name: string;
  readonly isMock: boolean;
  readonly capabilities: { text: boolean; voiceTranscript: boolean; imageUnderstanding: "browser-ocr-or-context" | "native" | "unavailable" };
  understand(input: CaptureDraftInput, now?: number): Promise<CaptureResult>;
}
