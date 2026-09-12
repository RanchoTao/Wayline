import { MockCaptureProvider } from "./mock";
import type { CaptureProvider } from "./types";

let provider: CaptureProvider | undefined;

export function getCaptureProvider(): CaptureProvider {
  provider ??= new MockCaptureProvider();
  return provider;
}

export type { CaptureProvider } from "./types";
