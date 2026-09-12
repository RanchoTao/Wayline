"use client";

import { useEffect, useState } from "react";
import type { WaylineTask } from "@/domain/models";
import { useWayline } from "@/store/wayline";
import { Waymark } from "@/components/WaylineBrand";
import { getLastPilotDeckMeta, getProviderInfo } from "@/lib/ai/provider";
import { CaptureModal } from "./CaptureModal";
import { PlanView } from "./PlanView";
import { ReviewView } from "./ReviewView";
import { TodayView } from "./TodayView";

type MainView = "today" | "plan" | "review";
const labels: Record<MainView, string> = { today: "今日", plan: "计划", review: "回顾" };

export function WaylineApp() {
  const [view, setView] = useState<MainView>("today");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<WaylineTask | null>(null);
  const hydrated = useWayline((state) => state.hydrated);
  const bootstrap = useWayline((state) => state.bootstrap);

  useEffect(() => {
    let active = true;
    void Promise.resolve(useWayline.persist.rehydrate()).then(() => { if (active) bootstrap(); });
    return () => { active = false; };
  }, [bootstrap]);

  if (!hydrated) return <main className="flex min-h-dvh items-center justify-center bg-[#f5f9fb] text-sm text-slate-500">正在恢复本地任务系统…</main>;

  const openTask = (task: WaylineTask) => { setSelectedTask(task); setView("plan"); };
  return <div className="min-h-dvh bg-[#f5f9fb] text-slate-900"><header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur"><div className="mx-auto flex min-h-16 max-w-6xl items-center gap-4 px-4 md:px-6"><button className="flex items-center gap-2" onClick={() => setView("today")} aria-label="返回今日"><Waymark /><strong className="tracking-[.12em]">WAYLINE</strong></button><nav className="ml-auto flex items-center gap-1" aria-label="主导航">{(Object.keys(labels) as MainView[]).map((item) => <button key={item} aria-current={view === item ? "page" : undefined} className={`rounded-full px-3 py-2 text-sm font-semibold ${view === item ? "bg-sky-50 text-sky-800" : "text-slate-500 hover:bg-slate-50"}`} onClick={() => { setSelectedTask(null); setView(item); }}>{labels[item]}</button>)}</nav><button className="rounded-full bg-sky-700 px-4 py-2 text-sm font-bold text-white" onClick={() => setCaptureOpen(true)}>＋ 记录</button></div></header>{view === "today" ? <TodayView onCapture={() => setCaptureOpen(true)} onOpenTask={openTask} onOpenPlan={() => setView("plan")} /> : view === "plan" ? <PlanView selectedTask={selectedTask} onOpenTask={setSelectedTask} onCloseTask={() => setSelectedTask(null)} /> : <ReviewView />}<CaptureModal open={captureOpen} onClose={() => setCaptureOpen(false)} /><PilotDeckDebugPanel /></div>;
}

/** Dev/demo aid shown only with ?debug=1: proves which provider handled the last AI call. */
function PilotDeckDebugPanel() {
  const [debug] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug"));
  const [meta, setMeta] = useState(getLastPilotDeckMeta());

  useEffect(() => {
    if (!debug) return;
    const timer = setInterval(() => setMeta(getLastPilotDeckMeta()), 500);
    return () => clearInterval(timer);
  }, [debug]);

  if (!debug) return null;
  const info = getProviderInfo();
  return (
    <div className="fixed bottom-3 right-3 z-50 w-72 rounded-xl border border-slate-200 bg-white/95 p-3 font-mono text-[11px] leading-5 shadow-lg" data-testid="pilotdeck-debug">
      <div className="mb-1 flex items-center justify-between"><strong className="text-slate-800">PILOTDECK DEBUG</strong><span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${info.mode === "mock" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{info.mode === "mock" ? "MOCK MODE" : "LIVE"}</span></div>
      <div className="space-y-0.5 text-slate-600">
        <div>provider: <span className="text-slate-900">{meta?.provider ?? "—"}</span></div>
        <div>model: <span className="text-slate-900">{meta?.model ?? "—"}</span></div>
        <div>request: <span className="text-slate-900">{meta?.requestType ?? "—"}</span></div>
        <div>latency: <span className="text-slate-900">{meta?.latencyMs != null ? `${meta.latencyMs} ms` : "—"}</span></div>
        <div>retry: <span className="text-slate-900">{meta?.retryCount ?? "—"}</span></div>
        <div>fallback: <span className="text-slate-900">{meta ? String(meta.fallback) : "—"}</span></div>
        <div>intent: <span className="text-slate-900">{meta?.intent ?? "—"}</span></div>
        <div>actionable: <span className="text-slate-900">{meta?.actionable == null ? "—" : String(meta.actionable)}</span></div>
        <div>generated tasks: <span className="text-slate-900">{meta?.suggestedTaskCount ?? "—"}</span></div>
        {meta?.fallbackReason && <div className="text-amber-700">reason: {meta.fallbackReason}</div>}
      </div>
      <div className="mt-1 border-t border-slate-100 pt-1 text-slate-400">primary {info.primary} · fallback {info.fallback}</div>
    </div>
  );
}
