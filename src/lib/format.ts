import { DAY_MS, HOUR_MS, MIN_MS } from "./time";

/** "8D 04H 12M" — mission-control countdown format. */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "00D 00H 00M";
  const d = Math.floor(ms / DAY_MS);
  const h = Math.floor((ms % DAY_MS) / HOUR_MS);
  const m = Math.floor((ms % HOUR_MS) / MIN_MS);
  return `${String(d).padStart(2, "0")}D ${String(h).padStart(2, "0")}H ${String(
    m
  ).padStart(2, "0")}M`;
}

/** Compact hours: "6h", "12.5h", "2d 4h" */
export function formatHours(hours: number): string {
  if (hours >= 48) {
    const d = Math.floor(hours / 24);
    const h = Math.round(hours % 24);
    return h > 0 ? `${d}d ${h}h` : `${d}d`;
  }
  if (Math.abs(hours - Math.round(hours)) < 0.05) return `${Math.round(hours)}h`;
  return `${hours.toFixed(1)}h`;
}

export function formatPct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

export function formatSignedHours(hours: number): string {
  const sign = hours > 0 ? "+" : hours < 0 ? "−" : "";
  return `${sign}${formatHours(Math.abs(hours))}`;
}

/** "SEP 20 · 18:00" */
export function formatDeadline(iso: string): string {
  const d = new Date(iso);
  const mon = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
  return `${mon} ${String(d.getDate()).padStart(2, "0")} · ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "SEP 11 09:42" for now-line labels */
export function formatStamp(iso: string): string {
  const d = new Date(iso);
  const mon = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
  return `${mon} ${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatDayShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
