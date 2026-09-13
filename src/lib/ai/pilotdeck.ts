import type { CaptureDraftInput, CaptureResult } from "@/domain/models";
import type { CaptureProvider } from "./types";

export interface PilotDeckMeta {
  provider: string;
  model: string;
  requestType: "text" | "multimodal";
  latencyMs: number;
  retryCount: number;
  fallback: boolean;
  fallbackReason?: string;
  intent?: string;
  actionable?: boolean;
  suggestedTaskCount?: number;
}

export interface PilotDeckBridgeResponse {
  ok: boolean;
  result?: CaptureResult;
  reason?: string;
  meta?: PilotDeckMeta;
}

function toDataUrl(media: NonNullable<CaptureDraftInput["media"]>): string {
  const bytes = new Uint8Array(media.bytes);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${media.type || "image/png"};base64,${btoa(binary)}`;
}

/**
 * Real PilotDeck bridge provider.
 *
 * The browser never sees the PilotDeck API key: this provider posts to the
 * Next.js server route /api/pilotdeck/understand, which reads the key from
 * $PILOT_HOME/pilotdeck.yaml inside the server process only.
 *
 * On any failure it throws; the caller (getCaptureProvider) falls back to the
 * local MockCaptureProvider so the demo never hangs on a dead API.
 */
export class PilotDeckCaptureProvider implements CaptureProvider {
  readonly name = "PILOTDECK";
  readonly isMock = false;
  readonly capabilities = { text: true, voiceTranscript: true, imageUnderstanding: "native" as const };

  private lastMeta: PilotDeckMeta | undefined;

  /** Latest bridge metadata (model, latency, requestType) from the last call. */
  get meta(): PilotDeckMeta | undefined {
    return this.lastMeta;
  }

  async understand(input: CaptureDraftInput): Promise<CaptureResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 50_000);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/pilotdeck/understand`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          inputType: input.inputType,
          text: input.text,
          imageDataUrl: input.media ? toDataUrl(input.media) : undefined,
          forceFailure: new URLSearchParams(window.location.search).has("forcePilotDeckFailure"),
        }),
        signal: controller.signal,
      });
      const data = (await res.json()) as PilotDeckBridgeResponse;
      if (!res.ok || !data.ok || !data.result) {
        throw new Error(data.reason ?? `bridge returned ${res.status}`);
      }
      this.lastMeta = data.meta;
      return data.result;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("PilotDeck request timed out");
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
