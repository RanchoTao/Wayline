import { DAY_MS, HOUR_MS, MIN_MS } from "./time";

/** 中文倒计时：天、时、分。 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "00天 00时 00分";
  const d = Math.floor(ms / DAY_MS);
  const h = Math.floor((ms % DAY_MS) / HOUR_MS);
  const m = Math.floor((ms % HOUR_MS) / MIN_MS);
  return `${String(d).padStart(2, "0")}天 ${String(h).padStart(2, "0")}时 ${String(
    m
  ).padStart(2, "0")}分`;
}

/** 工时显示，例如“6小时”或“2天 4小时”。 */
export function formatHours(hours: number): string {
  if (hours >= 48) {
    const d = Math.floor(hours / 24);
    const h = Math.round(hours % 24);
    return h > 0 ? `${d}天 ${h}小时` : `${d}天`;
  }
  if (Math.abs(hours - Math.round(hours)) < 0.05) return `${Math.round(hours)}小时`;
  return `${hours.toFixed(1)}小时`;
}

export function formatPct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

export function formatSignedHours(hours: number): string {
  const sign = hours > 0 ? "+" : hours < 0 ? "−" : "";
  return `${sign}${formatHours(Math.abs(hours))}`;
}

/** “9月20日 · 18:00” */
export function formatDeadline(iso: string): string {
  const d = new Date(iso);
  const mon = d.toLocaleString("zh-CN", { month: "short" }).toUpperCase();
  return `${mon}${d.getDate()}日 · ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 当前时间标记，例如“9月11日 09:42”。 */
export function formatStamp(iso: string): string {
  const d = new Date(iso);
  const mon = d.toLocaleString("zh-CN", { month: "short" }).toUpperCase();
  return `${mon}${d.getDate()}日 ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatDayShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
