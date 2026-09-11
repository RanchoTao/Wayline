"use client";

import { useWorkspace } from "@/store/workspace";
import { TopBar } from "@/components/TopBar";
import { AgentPanel } from "@/components/AgentPanel";
import { Timeline } from "@/components/Timeline";
import { TimeMetrics } from "@/components/TimeMetrics";
import { InsightPanel } from "@/components/InsightPanel";

function EmptyState() {
  const loadDemo = useWorkspace((s) => s.loadDemo);
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="vd-num text-[13px] font-black tracking-[0.3em] text-muted">
          VISUALDEADLINE
        </div>
        <h2 className="mt-1 text-[22px] font-black tracking-tight text-ink">
          MAKE TIME VISIBLE.
        </h2>
        <p className="vd-num mt-3 text-[12px] leading-relaxed text-muted">
          Type a vague goal in the AGENT panel — the agent decomposes it, schedules it
          against your deadline, scores risk, and draws a living timeline.
          <br />
          Or run the built-in demo story:
        </p>
        <div className="mt-5 flex flex-col items-center gap-2">
          <button
            className="vd-btn border border-ink bg-ink px-5 py-2.5 text-[13px] font-black tracking-wide text-white hover:bg-alarm hover:border-alarm"
            onClick={loadDemo}
          >
            LOAD HACKATHON DEMO
          </button>
          <div className="vd-label text-[9px] text-faint">
            DEMO: 65% TIME USED · 42% WORK DONE · BEHIND SCHEDULE · REPLAN ON “I ONLY HAVE 3 HOURS TODAY”
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const project = useWorkspace((s) => s.project);
  return (
    <div className="flex h-dvh flex-col bg-paper">
      <TopBar />
      <TimeMetrics />
      <main className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[25%_50%_25%] md:overflow-hidden">
        <AgentPanel />
        <section className="flex h-[70vh] min-h-0 flex-col border-r border-line bg-paper md:h-auto">
          {project ? (
            <Timeline project={project} />
          ) : (
            <EmptyState />
          )}
        </section>
        <InsightPanel />
      </main>
    </div>
  );
}
