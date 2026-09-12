"use client";

import { useMemo } from "react";
import { useWorkspace } from "@/store/workspace";
import { useNow } from "@/hooks/useNow";
import { computeMetrics } from "@/lib/metrics";
import { formatHours, formatPct } from "@/lib/format";

function Bar({ frac, tone }: { frac: number; tone: "red" | "ink" }) {
  const pct = Math.round(Math.min(1, Math.max(0, frac)) * 100);
  return (
    <div className="h-2 w-full overflow-hidden rounded-[1px] border border-line-strong bg-paper">
      <div
        className={`h-full ${tone === "red" ? "bg-alarm" : "bg-ink"} transition-[width] duration-500 ease-out`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/**
 * Time cognition strip (spec 8 + 9):
 * CALENDAR TIME / EFFECTIVE TIME / TIME USED / WORK DONE / SCHEDULE GAP.
 */
export function TimeMetrics() {
  const project = useWorkspace((s) => s.project);
  const now = useNow(1000);
  const m = useMemo(() => (project ? computeMetrics(project, now) : null), [project, now]);

  if (!project || !m) {
    return (
      <div className="wayline-metrics-empty flex h-14 shrink-0 items-center justify-center border-b border-line bg-card">
        <span className="vd-label">从一份计划，开启新的可能</span>
      </div>
    );
  }

  const behind = m.scheduleGap < 0;

  return (
    <div className="wayline-metrics grid shrink-0 grid-cols-2 gap-x-6 gap-y-2 border-b border-line bg-card px-4 py-2.5 md:grid-cols-5">
      <div>
        <div className="vd-label mb-0.5">距离截止</div>
        <div className="vd-num text-[15px] font-bold text-ink">
          {formatHours(m.remainingMs / 3_600_000)}{" "}
          <span className="text-[11px] font-medium text-muted">剩余</span>
        </div>
      </div>
      <div>
        <div className="vd-label mb-0.5">可用工时</div>
        <div className="vd-num text-[15px] font-bold text-ink">
          {m.availableHours.toFixed(1)} 小时{" "}
          <span className="text-[11px] font-medium text-muted">可用于工作</span>
        </div>
      </div>
      <div>
        <div className="vd-label mb-0.5">时间消耗</div>
        <Bar frac={m.timeUsedPercent} tone="red" />
        <div className="vd-num mt-0.5 text-[12px] font-bold text-alarm">
          {formatPct(m.timeUsedPercent)}
        </div>
      </div>
      <div>
        <div className="vd-label mb-0.5">任务完成</div>
        <Bar frac={m.workDonePercent} tone="ink" />
        <div className="vd-num mt-0.5 text-[12px] font-bold text-ink">
          {formatPct(m.workDonePercent)}
        </div>
      </div>
      <div className="col-span-2 md:col-span-1">
        <div className="vd-label mb-0.5">进度偏差</div>
        <div className="flex items-center gap-2">
          <span
            className={`vd-num rounded-[2px] border px-1.5 py-0.5 text-[14px] font-black ${
              behind
                ? "border-alarm bg-alarm-soft text-alarm-dark"
                : "border-ok text-ok"
            }`}
          >
            {behind ? "−" : "+"}
            {formatPct(Math.abs(m.scheduleGap))}
          </span>
          <span className={`vd-num text-[11px] font-bold ${behind ? "text-alarm" : "text-ok"}`}>
            {behind ? "落后" : "领先"}
          </span>
        </div>
        <div className="vd-num mt-0.5 text-[10px] text-muted">
          {behind ? "落后" : "领先"} {Math.abs(m.scheduleGapHours).toFixed(1)} 小时工时
        </div>
      </div>
    </div>
  );
}
