import { computeRisk, riskLevelOf } from "@/lib/metrics";
import type { Project } from "@/lib/types";

const LEVEL_STYLE: Record<string, string> = {
  LOW: "border-ok text-ok",
  MEDIUM: "border-[#c9a300] text-[#8a6d00] bg-[#fff8e0]",
  HIGH: "border-alarm text-alarm-dark bg-alarm-soft",
  CRITICAL: "border-alarm text-white bg-alarm",
};

/** Small red/amber/green risk chip (animated via key change). */
export function RiskBadge({ project, now }: { project: Project; now: number }) {
  const risk = computeRisk(project, now);
  const level = riskLevelOf(risk.score);
  const cls = LEVEL_STYLE[level] ?? LEVEL_STYLE.LOW;
  return (
    <span
      key={`${level}-${risk.score.toFixed(2)}`}
      className={`vd-rise vd-num inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-0.5 text-[11px] font-bold tracking-wide ${cls}`}
      title={risk.reasons.join(" · ")}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {risk.score.toFixed(2)} {level}
    </span>
  );
}
