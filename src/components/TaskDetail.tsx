"use client";

import { taskName, systemText, taskStatusText } from "@/lib/zh";
import { useState } from "react";
import { useWorkspace } from "@/store/workspace";
import type { Task } from "@/lib/types";
import { formatHours } from "@/lib/format";

const STATUS_OPTIONS: Task["status"][] = ["todo", "in_progress", "done", "deferred", "cancelled"];

/** Lightweight task detail editor (spec 17): progress, status, title, deadline is top-bar. */
export function TaskDetail({ task, onClose }: { task: Task; onClose: () => void }) {
  const setTaskProgress = useWorkspace((s) => s.setTaskProgress);
  const setTaskStatus = useWorkspace((s) => s.setTaskStatus);
  const setTaskTitle = useWorkspace((s) => s.setTaskTitle);
  const [title, setTitle] = useState(taskName(task.title));

  const remaining = Math.max(0, task.estimatedHours - task.completedHours);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40"
      onClick={onClose}
    >
      <div
        className="vd-rise w-[min(92vw,460px)] border border-line-strong bg-card p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="vd-label">任务详情</h3>
          <button className="vd-label cursor-pointer text-muted hover:text-alarm" onClick={onClose}>
            关闭 ✕
          </button>
        </div>

        <label className="vd-label mb-1 block">任务名称</label>
        <input
          className="vd-input mb-3 w-full border border-line-strong px-2 py-1 text-[13px]"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== taskName(task.title) && setTaskTitle(task.id, title.trim())}
        />

        <label className="vd-label mb-1 block">任务状态</label>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setTaskStatus(task.id, s)}
              className={`vd-num border px-2 py-0.5 text-[10px] font-bold ${
                task.status === s
                  ? "border-ink bg-ink text-white"
                  : "border-line-strong text-muted hover:border-ink hover:text-ink"
              }`}
            >
              {taskStatusText[s]}
            </button>
          ))}
        </div>

        <label className="vd-label mb-1 block">完成进度</label>
        <div className="mb-1 flex gap-1.5">
          {[0, 25, 50, 75, 100].map((p) => (
            <button
              key={p}
              onClick={() => setTaskProgress(task.id, p / 100)}
              className={`vd-num flex-1 border py-1 text-[11px] font-bold ${
                Math.round(task.progress * 100) === p
                  ? "border-alarm bg-alarm-soft text-alarm-dark"
                  : "border-line-strong text-muted hover:border-ink hover:text-ink"
              }`}
            >
              {p}%
            </button>
          ))}
        </div>
        <div className="mb-3 h-2 overflow-hidden rounded-[1px] border border-line-strong">
          <div
            className="h-full bg-alarm transition-[width] duration-300"
            style={{ width: `${Math.round(task.progress * 100)}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-2 border-t border-line pt-3 text-[11px]">
          <div>
            <div className="vd-label">预计工时</div>
            <div className="vd-num font-bold">{formatHours(task.estimatedHours)}</div>
          </div>
          <div>
            <div className="vd-label">已完成工时</div>
            <div className="vd-num font-bold">{formatHours(task.completedHours)}</div>
          </div>
          <div>
            <div className="vd-label">剩余工时</div>
            <div className="vd-num font-bold text-alarm">{formatHours(remaining)}</div>
          </div>
        </div>

        {task.description && (
          <p className="vd-num mt-3 border-t border-line pt-2 text-[11px] leading-relaxed text-muted">
            {systemText(task.description)}
          </p>
        )}

        <div className="vd-label mt-3 text-[10px] text-muted">
          调整进度或状态后，风险与计划将实时更新。
        </div>
      </div>
    </div>
  );
}
