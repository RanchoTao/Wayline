"use client";

import { taskName, systemText, taskStatusText } from "@/lib/zh";
import { useMemo, useState } from "react";
import { useWorkspace } from "@/store/workspace";
import { useNow } from "@/hooks/useNow";
import type { Project, Task } from "@/lib/types";
import { formatDayShort, formatDeadline, formatHours, formatStamp } from "@/lib/format";
import { parseIso } from "@/lib/time";
import { TaskDetail } from "./TaskDetail";



function TaskRow({
  task,
  axis,
  changed,
  onOpen,
}: {
  task: Task;
  axis: { createdAt: number; total: number };
  changed: boolean;
  onOpen: () => void;
}) {
  const start = parseIso(task.start);
  const end = parseIso(task.end);
  const left = Math.max(0, ((start - axis.createdAt) / axis.total) * 100);
  const width = Math.max(1.5, ((end - start) / axis.total) * 100);
  const fill = Math.round(Math.min(1, Math.max(0, task.progress)) * 100);

  const cancelled = task.status === "cancelled";
  const deferred = task.status === "deferred";

  const barCls = cancelled
    ? "border-dashed border-line-strong bg-paper opacity-50"
    : deferred
      ? "border-dashed border-faint bg-paper opacity-70"
      : task.status === "done"
        ? "border-ink bg-ink"
        : task.status === "in_progress"
          ? "border-alarm bg-alarm-soft"
          : "border-line-strong bg-paper hover:border-ink";

  return (
    <div
      className={`vd-rise group relative flex h-9 items-stretch ${changed ? "vd-flash" : ""}`}
      onClick={onOpen}
    >
      {/* label column */}
      <div className="flex w-44 shrink-0 flex-col justify-center border-r border-line px-2 pr-3">
        <div className="flex items-center gap-1.5">
          {task.isCritical && (
            <span className="vd-label shrink-0 rounded-[1px] bg-alarm px-1 py-px text-[8px] text-white">
              关键
            </span>
          )}
          <span
            className={`truncate text-[12px] font-semibold ${
              cancelled
                ? "text-faint line-through"
                : deferred
                  ? "text-faint line-through"
                  : task.status === "done"
                    ? "text-ink"
                    : "text-ink"
            }`}
          >
            {taskName(task.title)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="vd-num text-[10px] text-muted">{formatHours(task.estimatedHours)}</span>
          <span
            className={`vd-num text-[9px] font-bold ${
              task.status === "done"
                ? "text-ok"
                : task.status === "in_progress"
                  ? "text-alarm"
                  : cancelled || deferred
                    ? "text-faint"
                    : "text-muted"
            }`}
          >
            {taskStatusText[task.status]}
          </span>
        </div>
      </div>

      {/* bar track */}
      <div className="relative min-w-0 flex-1">
        {/* faint grid at quarters */}
        {[25, 50, 75].map((p) => (
          <div key={p} className="absolute inset-y-0 w-px bg-paper" style={{ left: `${p}%` }} />
        ))}
        <div
          className={`absolute inset-y-2 cursor-pointer rounded-[2px] border transition-[left,width] duration-500 ease-out ${barCls}`}
          style={{ left: `${left}%`, width: `${width}%` }}
          title={`${taskName(task.title)} · ${task.status} · ${fill}%`}
        >
          {task.progress > 0 && task.status !== "done" && (
            <div
              className="h-full bg-alarm/25 transition-[width] duration-500"
              style={{ width: `${fill}%` }}
            />
          )}
        </div>
        {/* small time labels at bar ends */}
        <span className="vd-num pointer-events-none absolute -top-2 text-[8px] text-faint" style={{ left: `${left}%` }}>
          {formatDayShort(task.start)}
        </span>
      </div>
    </div>
  );
}

export function Timeline({ project }: { project: Project }) {
  const now = useNow(1000);
  const changedTaskIds = useWorkspace((s) => s.changedTaskIds);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const axis = useMemo(() => {
    const createdAt = parseIso(project.createdAt);
    const deadline = parseIso(project.deadline);
    return { createdAt, total: Math.max(1, deadline - createdAt) };
  }, [project.createdAt, project.deadline]);

  const nowPct = Math.min(100, Math.max(0, ((now - axis.createdAt) / axis.total) * 100));
  const selected = project.tasks.find((t) => t.id === selectedId) ?? null;

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <div className="flex items-baseline gap-3">
          <h2 className="vd-label">时间线</h2>
          <span className="vd-num text-[12px] font-bold text-ink">{formatDayShort(new Date(now).toISOString())}</span>
        </div>
        <div className="vd-num text-[12px] font-bold text-alarm">
          现在 <span className="vd-blink">▮</span> {formatStamp(new Date(now).toISOString())}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-4 pb-2 pt-3">
          {/* task rows */}
          <div className="flex flex-col gap-1">
            {project.tasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                axis={axis}
                changed={changedTaskIds.includes(t.id)}
                onOpen={() => setSelectedId(t.id)}
              />
            ))}
          </div>

          {/* milestones */}
          <div className="mt-4 border-t border-line pt-3">
            <div className="vd-label mb-2">里程碑</div>
            <div className="relative h-6 border-b border-line">
              {project.milestones.map((ms) => {
                const pct = Math.min(100, Math.max(0, ((parseIso(ms.at) - axis.createdAt) / axis.total) * 100));
                const dot =
                  ms.status === "reached"
                    ? "bg-ink border-ink"
                    : ms.status === "at_risk"
                      ? "bg-alarm border-alarm"
                      : "bg-card border-line-strong";
                return (
                  <div
                    key={ms.id}
                    className="absolute -bottom-[7px] -translate-x-1/2"
                    style={{ left: `${pct}%` }}
                    title={`${systemText(ms.title)} · ${ms.status.toUpperCase()}`}
                  >
                    <span className={`block h-3 w-3 rotate-45 border ${dot}`} />
                  </div>
                );
              })}
            </div>
            <div className="relative mt-2">
              {project.milestones.map((ms) => {
                const pct = Math.min(100, Math.max(0, ((parseIso(ms.at) - axis.createdAt) / axis.total) * 100));
                return (
                  <div key={ms.id} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${pct}%` }}>
                    <span
                      className={`vd-num text-[9px] ${
                        ms.status === "at_risk" ? "text-alarm" : ms.status === "reached" ? "text-ink" : "text-muted"
                      }`}
                    >
                      {systemText(ms.title)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* deadline band */}
          <div className="relative mt-6 h-7">
            <div className="absolute inset-x-0 bottom-0 border-b-2 border-alarm" />
            {/* NOW line */}
            <div className="absolute bottom-[-2px] top-[-90px] z-10 w-px bg-alarm" style={{ left: `${nowPct}%` }}>
              <span className="vd-num absolute -top-5 left-1 rounded-[1px] bg-alarm px-1 text-[9px] font-black text-white">
                现在 {formatStamp(new Date(now).toISOString())}
              </span>
            </div>
            {/* DEADLINE */}
            <div className="absolute right-0 top-0 -translate-y-1/2 text-right">
              <div className="vd-pulse vd-num inline-block rounded-[2px] border border-alarm bg-alarm-soft px-1.5 py-0.5 text-[11px] font-black text-alarm-dark">
                截止时间 {formatDeadline(project.deadline)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {selected && <TaskDetail task={selected} onClose={() => setSelectedId(null)} />}
    </section>
  );
}
