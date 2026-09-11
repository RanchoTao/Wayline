export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;
export const MIN_MS = 60_000;

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function clamp01(n: number): number {
  return clamp(n, 0, 1);
}

export function parseIso(s: string): number {
  return new Date(s).getTime();
}

export function toIso(t: number): string {
  return new Date(t).toISOString();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function daysBetween(aIso: string, bIso: string): number {
  return (parseIso(bIso) - parseIso(aIso)) / DAY_MS;
}

export function addHours(iso: string, hours: number): string {
  return toIso(parseIso(iso) + hours * HOUR_MS);
}

export function uid(prefix = "t"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
