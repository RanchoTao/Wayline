"use client";

import { useState } from "react";
import { Daybook, WorkspaceMenu, WorkspaceView } from "@/components/Daybook";
import { useWorkspace } from "@/store/workspace";
import { TopBar } from "@/components/TopBar";
import { AgentPanel } from "@/components/AgentPanel";
import { Timeline } from "@/components/Timeline";
import { TimeMetrics } from "@/components/TimeMetrics";
import { FlightScene } from "@/components/WaylineBrand";
import { InsightPanel } from "@/components/InsightPanel";

function EmptyState() {
  const loadDemo = useWorkspace((s) => s.loadDemo);
  return (
    <div className="wayline-empty">
      <div className="wayline-eyebrow">让明天更清晰</div>
      <h2>让目标，步步可达。</h2>
      <p>从一个想法，到一条清晰的路。<br />写下目标，让每一天都有方向。</p>
      <button className="vd-btn wayline-primary" onClick={loadDemo}>
        加载示例计划 <span aria-hidden="true">↗</span>
      </button>
      <span className="wayline-empty-note">或在左侧输入你的目标，开启自己的计划</span>
      <FlightScene className="wayline-empty-scene" />
      <div className="wayline-steps"><span>01 · 设定目标</span><span>02 · 理清路径</span><span>03 · 稳步前行</span></div>
    </div>
  );
}

export default function Page() {
  const [view, setView] = useState(WorkspaceView.Plan);
  const project = useWorkspace((s) => s.project);
  return (
    <div className="wayline-app flex h-dvh flex-col bg-paper">
      <TopBar />
      <div className="wayline-banner">
        <div><div className="wayline-eyebrow">你的专属计划空间</div>
          <h2>看清当下，<br /><em>规划前路。</em></h2>
          <p>心得境，事承令 <span>— 每一步，都更接近目标</span></p>
        </div>
        <FlightScene className="wayline-banner-scene" />
        <span className="wayline-banner-caption">从想法出发，向目标前行</span>
      </div>
      <WorkspaceMenu value={view} onChange={setView} />
      {view === WorkspaceView.Plan ? <>
      <TimeMetrics />
      <main className="wayline-workspace grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[25%_50%_25%] md:overflow-hidden">
        <AgentPanel />
        <section className="wayline-timeline-panel flex h-[70vh] min-h-0 flex-col border-r border-line bg-paper md:h-auto">
          {project ? (
            <Timeline project={project} />
          ) : (
            <EmptyState />
          )}
        </section>
        <InsightPanel />
      </main>
      </> : <Daybook view={view} />}
    </div>
  );
}
