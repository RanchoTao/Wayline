"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReviewRange } from "@/domain/models";
import { buildReview } from "@/domain/review";
import { useNow } from "@/hooks/useNow";
import { useWayline } from "@/store/wayline";

const ranges: Array<{ value: ReviewRange; label: string }> = [{ value: "today", label: "今天" }, { value: "week", label: "本周" }, { value: "7d", label: "最近 7 天" }, { value: "30d", label: "最近 30 天" }];

export function ReviewView() {
  const [range, setRange] = useState<ReviewRange>("week");
  const tasks = useWayline((state) => state.tasks);
  const projects = useWayline((state) => state.projects);
  const reviews = useWayline((state) => state.reviews);
  const generateReview = useWayline((state) => state.generateReview);
  const applyReviewSuggestion = useWayline((state) => state.applyReviewSuggestion);
  const now = useNow(60_000);
  const computed = useMemo(() => buildReview(tasks, projects, range, now), [tasks, projects, range, now]);
  const review = reviews.find((item) => item.id === computed.id) ?? computed;

  useEffect(() => { generateReview(range, now); }, [generateReview, now, projects, range, tasks]);

  const metrics = review.statistics;
  return <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 md:px-6" data-testid="review-page"><header><p className="text-sm font-semibold text-sky-700">REVIEW</p><h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">让系统替你完成定期复盘。</h2><p className="mt-2 text-sm text-slate-500">只基于本机任务事实、偏差与模式；调整必须由你确认。</p></header><div className="flex flex-wrap gap-2">{ranges.map((item) => <button key={item.value} className={`rounded-full px-4 py-2 text-sm font-semibold ${range === item.value ? "bg-sky-700 text-white" : "bg-white text-slate-600"}`} onClick={() => setRange(item.value)}>{item.label}</button>)}</div><section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["完成任务", metrics.completedTasks], ["计划任务", metrics.plannedTasks], ["完成率", `${metrics.completionRate}%`], ["延期任务", metrics.deferredTasks], ["取消任务", metrics.cancelledTasks], ["新增任务", metrics.newTasks], ["推进最多", metrics.biggestProgressProject ?? "暂无"], ["平均估时偏差", metrics.estimateVarianceMinutes === undefined ? "暂无实际用时" : `${metrics.estimateVarianceMinutes >= 0 ? "+" : ""}${metrics.estimateVarianceMinutes} 分钟`]].map(([label, value]) => <article key={label} className="rounded-2xl border border-white/80 bg-white p-4 shadow-sm"><p className="text-xs font-semibold text-slate-400">{label}</p><strong className="mt-2 block text-2xl text-slate-950">{value}</strong></article>)}</section><section className="grid gap-4 lg:grid-cols-2"><article className="rounded-[1.5rem] bg-white p-5 shadow-sm"><h3 className="text-lg font-bold text-slate-950">事实与偏差</h3><ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">{review.facts.map((fact) => <li key={fact}>· {fact}</li>)}{review.patterns.map((pattern) => <li key={pattern} className="rounded-xl bg-amber-50 px-3 py-2 text-amber-800">{pattern}</li>)}</ul></article><article className="rounded-[1.5rem] bg-slate-950 p-5 text-white shadow-sm"><p className="text-xs font-bold tracking-[.16em] text-sky-300">AI REVIEW · DETERMINISTIC FALLBACK</p><p className="mt-4 whitespace-pre-line text-sm leading-7 text-white/75">{review.narrative}</p></article></section><section className="rounded-[1.5rem] border border-white/80 bg-white p-5 shadow-sm"><h3 className="text-lg font-bold text-slate-950">Suggested Adjustments</h3><p className="mt-1 text-sm text-slate-500">建议不会自动改计划。</p><div className="mt-4 space-y-3">{review.suggestions.map((suggestion) => <article key={suggestion.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-sky-50 p-4"><div><b className="text-slate-900">{suggestion.title}</b><p className="mt-1 text-sm text-slate-600">{suggestion.reason}</p></div><button className="rounded-full bg-white px-4 py-2 text-sm font-bold text-sky-700 shadow-sm disabled:text-emerald-700" disabled={suggestion.status === "applied"} onClick={() => applyReviewSuggestion(review.id, suggestion.id)}>{suggestion.status === "applied" ? "已应用" : "应用建议"}</button></article>)}{!review.suggestions.length && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">当前没有足够的真实数据提出调整。</p>}</div></section></main>;
}
