"use client";

import { useMemo } from "react";
import { useWorkspace } from "@/store/workspace";
import { useNow } from "@/hooks/useNow";
import { computeMetrics, computeRisk, riskLevelOf } from "@/lib/metrics";
import { buildInsight, findBottleneck } from "@/lib/agent/riskAnalyzer";
import { formatHours } from "@/lib/format";
import { isMockAgent } from "@/lib/pilotdeck/provider";

const LEVEL_STYLE: Record<string, string> = {
  LOW: "border-ok text-ok",
  MEDIUM: "border-[#c9a300] text-[#8a6d00]",
  HIGH: "border-alarm text-alarm-dark",
  CRITICAL: "border-alarm text-white bg-alarm",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="vd-label mb-1 text-[10px] text-muted">{children}</div>;
}

export function InsightPanel() {
  const project = useWorkspace((s) => s.project);
  const pendingPlan = useWorkspace((s) => s.pendingPlan);
  const thinking = useWorkspace((s) => s.thinking);
  const applyPendingPlan = useWorkspace((s) => s.applyPendingPlan);
  const discardPendingPlan = useWorkspace((s) => s.discardPendingPlan);
  const now = useNow(5000);

  const current = useMemo(() => {
    if (!project) return null;
    const m = computeMetrics(project, now);
    const risk = computeRisk(project, now, m);
    const insight = buildInsight(project, now, risk);
    const bottleneck = findBottleneck(project);
    return { m, risk, insight, bottleneck };
  }, [project, now]);

  const next = useMemo(() => {
    if (!pendingPlan) return null;
    const m = computeMetrics(pendingPlan.project, now);
    const risk = computeRisk(pendingPlan.project, now, m);
    return { m, risk };
  }, [pendingPlan, now]);

  return (
    <aside className="flex h-[70vh] min-h-0 flex-col border-l border-line bg-card md:h-auto">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="vd-label">Agent Insight</h2>
        <span className="vd-num text-[9px] text-faint">
          {isMockAgent() ? "DETERMINISTIC ENGINE" : "PILOTDECK"}
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
        {!current && (
          <div className="vd-num mt-8 text-center text-[11px] leading-relaxed text-faint">
            No project yet.
            <br />
            Agent insight appears once a plan exists.
          </div>
        )}

        {current && !pendingPlan && (
          <>
            {/* risk */}
            <section>
              <SectionLabel>Risk</SectionLabel>
              <div className="flex items-center gap-3">
                <div className="vd-num text-[40px] font-black leading-none text-ink">
                  {current.risk.score.toFixed(2)}
                </div>
                <span
                  className={`vd-num rounded-[2px] border px-1.5 py-0.5 text-[11px] font-black ${LEVEL_STYLE[riskLevelOf(current.risk.score)]}`}
                >
                  {riskLevelOf(current.risk.score)}
                </span>
              </div>
              <div className="mt-1.5 flex flex-col gap-0.5">
                {current.risk.reasons.map((r, i) => (
                  <div key={i} className="vd-num text-[10px] leading-relaxed text-muted">
                    • {r}
                  </div>
                ))}
              </div>
            </section>

            {/* status */}
            <section className="border-t border-line pt-4">
              <SectionLabel>Current status</SectionLabel>
              <div className={`vd-num text-[13px] font-black ${current.m.scheduleGap < 0 ? "text-alarm" : "text-ok"}`}>
                {current.insight.statusText}
              </div>
              <div className="vd-num mt-0.5 text-[10px] text-muted">
                {formatHours(current.m.remainingMs / 3_600_000)} left ·{" "}
                {current.m.requiredHours.toFixed(1)}h required ·{" "}
                {current.m.availableHours.toFixed(1)}h available
              </div>
            </section>

            {/* bottleneck */}
            <section className="border-t border-line pt-4">
              <SectionLabel>Main bottleneck</SectionLabel>
              {current.bottleneck ? (
                <>
                  <div className="vd-num text-[14px] font-black text-ink">
                    {current.bottleneck.title.toUpperCase()}
                  </div>
                  <div className="vd-num mt-1 text-[10px] leading-relaxed text-muted">
                    {current.insight.bottleneckReason}
                  </div>
                </>
              ) : (
                <div className="vd-num text-[11px] text-ok">No open bottleneck — all critical work is moving.</div>
              )}
            </section>

            {/* next action */}
            <section className="border-t border-line pt-4">
              <SectionLabel>Next best action</SectionLabel>
              <pre className="vd-num whitespace-pre-wrap text-[11px] leading-relaxed text-ink">
                {current.insight.recommendedAction}
              </pre>
            </section>
          </>
        )}

        {/* replan ready */}
        {current && pendingPlan && next && (
          <>
            <section className="vd-pulse border border-alarm bg-alarm-soft p-3">
              <div className="vd-label mb-1 text-alarm-dark">Replan ready</div>
              <div className="vd-num text-[11px] leading-relaxed text-ink">
                {pendingPlan.explanation}
              </div>
            </section>

            <section className="border-t border-line pt-3">
              <SectionLabel>Risk change</SectionLabel>
              <div className="flex items-center gap-2">
                <span className="vd-num border border-line-strong px-1.5 py-0.5 text-[12px] font-black text-muted">
                  {current.risk.score.toFixed(2)} {riskLevelOf(current.risk.score)}
                </span>
                <span className="vd-num text-alarm">→</span>
                <span
                  className={`vd-num border px-1.5 py-0.5 text-[12px] font-black ${LEVEL_STYLE[riskLevelOf(next.risk.score)]}`}
                >
                  {next.risk.score.toFixed(2)} {riskLevelOf(next.risk.score)}
                </span>
              </div>
              <div className="vd-num mt-1 text-[10px] text-muted">
                {next.risk.reasons.slice(0, 2).map((r, i) => (
                  <div key={i}>• {r}</div>
                ))}
              </div>
            </section>

            <section className="border-t border-line pt-3">
              <SectionLabel>Affected tasks</SectionLabel>
              <div className="flex flex-col gap-1">
                {pendingPlan.changedTaskIds.slice(0, 12).map((id) => {
                  const before = project?.tasks.find((t) => t.id === id);
                  const after = pendingPlan.project.tasks.find((t) => t.id === id);
                  if (!before || !after) return null;
                  const changed =
                    before.status !== after.status || before.priority !== after.priority;
                  return (
                    <div key={id} className="vd-num flex items-center justify-between text-[10px]">
                      <span className={`truncate ${after.status === "cancelled" || after.status === "deferred" ? "text-faint line-through" : "text-ink"}`}>
                        {after.title}
                      </span>
                      <span className={`shrink-0 font-bold ${changed ? "text-alarm" : "text-faint"}`}>
                        {before.status !== after.status
                          ? `${before.status} → ${after.status}`
                          : before.priority !== after.priority
                            ? `${before.priority} → ${after.priority}`
                            : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="flex gap-2 border-t border-line pt-3">
              <button
                className="vd-btn flex-1 border border-alarm bg-alarm px-3 py-2 text-[12px] font-black text-white hover:bg-alarm-dark disabled:opacity-40"
                onClick={applyPendingPlan}
                disabled={thinking}
              >
                APPLY PLAN
              </button>
              <button
                className="vd-btn border border-line-strong px-3 py-2 text-[11px] text-muted hover:border-ink hover:text-ink"
                onClick={discardPendingPlan}
              >
                DISCARD
              </button>
            </section>
          </>
        )}

        {/* pipeline readout */}
        <section className="border-t border-line pt-3">
          <SectionLabel>Agent pipeline</SectionLabel>
          <div className="vd-num flex flex-wrap items-center gap-1 text-[9px] text-muted">
            {["Goal", "Decompose", "Schedule", "Risk", "Replan"].map((s, i) => (
              <span key={s} className="flex items-center gap-1">
                <span className="rounded-[1px] border border-line-strong px-1 py-px">{s}</span>
                {i < 4 && <span className="text-faint">→</span>}
              </span>
            ))}
          </div>
          <div className="vd-num mt-1.5 text-[9px] leading-relaxed text-faint">
            Deterministic local engine · swaps to PilotDeck SDK without UI changes
          </div>
        </section>
      </div>
    </aside>
  );
}
