"use client";

import { useEffect, useState } from "react";
import type { WaylineTask } from "@/domain/models";
import { useWayline } from "@/store/wayline";
import { Waymark } from "@/components/WaylineBrand";
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
  return <div className="min-h-dvh bg-[#f5f9fb] text-slate-900"><header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur"><div className="mx-auto flex min-h-16 max-w-6xl items-center gap-4 px-4 md:px-6"><button className="flex items-center gap-2" onClick={() => setView("today")} aria-label="返回今日"><Waymark /><strong className="tracking-[.12em]">WAYLINE</strong></button><nav className="ml-auto flex items-center gap-1" aria-label="主导航">{(Object.keys(labels) as MainView[]).map((item) => <button key={item} aria-current={view === item ? "page" : undefined} className={`rounded-full px-3 py-2 text-sm font-semibold ${view === item ? "bg-sky-50 text-sky-800" : "text-slate-500 hover:bg-slate-50"}`} onClick={() => { setSelectedTask(null); setView(item); }}>{labels[item]}</button>)}</nav><button className="rounded-full bg-sky-700 px-4 py-2 text-sm font-bold text-white" onClick={() => setCaptureOpen(true)}>＋ 记录</button></div></header>{view === "today" ? <TodayView onCapture={() => setCaptureOpen(true)} onOpenTask={openTask} onOpenPlan={() => setView("plan")} /> : view === "plan" ? <PlanView selectedTask={selectedTask} onOpenTask={setSelectedTask} onCloseTask={() => setSelectedTask(null)} /> : <ReviewView />}<CaptureModal open={captureOpen} onClose={() => setCaptureOpen(false)} /></div>;
}
