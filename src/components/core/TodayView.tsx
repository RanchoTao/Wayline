"use client";

import { useMemo } from "react";
import type { WaylineTask } from "@/domain/models";
import { analyzeTask, heatZoneTasks, importancePosition, priorityScore, topTasks } from "@/domain/priority/engine";
import { useNow } from "@/hooks/useNow";
import { useWayline } from "@/store/wayline";

function remainingLabel(deadline?: string, now = Date.now()) {
  if (!deadline) return "无截止时间";
  const minutes = Math.round((new Date(deadline).getTime() - now) / 60_000);
  if (minutes < 0) return `已逾期 ${Math.max(1, Math.round(Math.abs(minutes) / 60))} 小时`;
  if (minutes < 24 * 60) return `还剩 ${Math.max(1, Math.round(minutes / 60))} 小时`;
  return `还剩 ${Math.ceil(minutes / 1440)} 天`;
}

export function TodayView({ onCapture, onOpenTask, onOpenPlan }: { onCapture: () => void; onOpenTask: (task: WaylineTask) => void; onOpenPlan: () => void }) {
  const tasks = useWayline((state) => state.tasks);
  const projects = useWayline((state) => state.projects);
  const completeTask = useWayline((state) => state.completeTask);
  const now = useNow(60_000);
  const top = useMemo(() => topTasks(tasks, now), [tasks, now]);
  const heat = useMemo(() => heatZoneTasks(tasks, now), [tasks, now]);
  const projectNames = useMemo(() => new Map(projects.map((project) => [project.id, project.title])), [projects]);

  return <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 md:px-6">
    <header><p className="text-sm font-semibold text-sky-700">{new Date(now).toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })}</p><h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">先走最值得走的一步。</h2><p className="mt-2 text-sm text-slate-500">{top[0] ? `当前第一优先：${top[0].title}` : "当前没有待执行任务，可以记录一个新目标。"}</p></header>
    <section className="rounded-[1.5rem] border border-white/80 bg-white/80 p-4 shadow-sm md:p-5" aria-labelledby="heat-zone-title">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold tracking-[.16em] text-sky-700">CURRENT FOCUS</p><h3 id="heat-zone-title" className="mt-1 text-xl font-bold text-slate-950">当前任务热区</h3><p className="mt-1 text-sm text-slate-500">仅展示 30 天内最需要关注的可执行任务。</p></div><button className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600" onClick={onOpenPlan}>查看完整矩阵</button></div>
      <div className="relative mt-4 h-64 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-sky-50/40 to-rose-50/70" data-testid="heat-zone">
        <div className="absolute inset-x-6 bottom-8 top-8 border border-slate-200" /><div className="absolute inset-y-8 left-1/2 border-l border-slate-200" /><div className="absolute inset-x-6 top-1/2 border-t border-slate-200" />
        <span className="absolute left-8 top-3 text-[10px] text-slate-400">低重要性</span><span className="absolute right-8 top-3 text-[10px] text-slate-400">高重要性</span><span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-rose-500">截止死亡线</span>
        {!heat.length && <p className="absolute inset-x-8 top-1/2 -translate-y-1/2 text-center text-sm text-slate-400">30 天内没有临近截止任务。</p>}
        {heat.map((task, index) => {
          const analysis = analyzeTask(task, tasks, now);
          const left = Math.min(90, Math.max(10, importancePosition(task.importance) + (index % 3 - 1) * 1.5));
          const topPos = Math.min(88, Math.max(16, 100 - analysis.matrixPosition.x));
          return <button key={task.id} data-task-id={task.id} data-quadrant={analysis.matrixPosition.quadrant} className="absolute -translate-x-1/2 -translate-y-1/2 text-left" style={{ left: `${left}%`, top: `${topPos}%` }} onClick={() => onOpenTask(task)} title={`${task.title} · 压力 ${analysis.pressure}`}><span className={`block h-3.5 w-3.5 rounded-full border-2 border-white shadow ${task.importance >= 8 ? "bg-rose-500" : "bg-sky-500"}`} /><span className={`absolute top-1/2 w-28 -translate-y-1/2 truncate rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-700 shadow-sm ${left > 70 ? "right-5 text-right" : "left-5"}`}>{task.title}</span></button>;
        })}
      </div>
    </section>
    <section aria-labelledby="top-three-title"><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold tracking-[.16em] text-sky-700">NEXT ACTION</p><h3 id="top-three-title" className="mt-1 text-xl font-bold text-slate-950">最近最该做的三件事</h3></div><span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-sky-700">Top 3</span></div>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">{top.map((task, index) => { const analysis = analyzeTask(task, tasks, now); return <article key={task.id} data-testid={`top-task-${index + 1}`} data-task-id={task.id} data-priority={priorityScore(task, now)} className="rounded-[1.25rem] border border-white/80 bg-white/85 p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><button className="text-left font-bold text-slate-950 hover:text-sky-700" onClick={() => onOpenTask(task)}>{index + 1}. {task.title}</button><span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">{task.importance}/10</span></div><p className="mt-3 rounded-xl bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-800">{analysis.reason}</p><div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500"><span>{projectNames.get(task.projectId ?? "") ?? "收集箱"}</span><span>{remainingLabel(task.deadline, now)}</span><span>{task.estimatedMinutes ?? "—"} 分钟</span><span>{task.status === "in_progress" ? "进行中" : analysis.blocked ? "等待前置" : "待开始"}</span></div><button className="mt-4 w-full rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-40" disabled={analysis.blocked} onClick={() => completeTask(task.id)}>标记完成</button></article>; })}</div>
      {!top.length && <div className="mt-3 rounded-2xl bg-white p-6 text-center text-sm text-slate-500">任务序列已清空。用“记录一件事”开始下一段。</div>}
    </section>
    <button className="flex w-full items-center justify-between rounded-[1.25rem] border border-dashed border-sky-300 bg-sky-50/70 px-5 py-4 text-left" onClick={onCapture}><span><b className="text-slate-900">＋ 记录一件事</b><small className="mt-1 block text-slate-500">文字、语音和图片统一进入理解与确认流程</small></span><span className="text-sky-700">打开 →</span></button>
  </main>;
}
