"use client";

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
  const [title, setTitle] = useState(task.title);

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
          <h3 className="vd-label">Task</h3>
          <button className="vd-label cursor-pointer text-muted hover:text-alarm" onClick={onClose}>
            CLOSE ✕
          </button>
        </div>

        <label className="vd-label mb-1 block">Title</label>
        <input
          className="vd-input mb-3 w-full border border-line-strong px-2 py-1 text-[13px]"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && setTaskTitle(task.id, title.trim())}
        />

        <label className="vd-label mb-1 block">Status</label>
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
              {s.toUpperCase()}
            </button>
          ))}
        </div>

        <label className="vd-label mb-1 block">Progress</label>
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
            <div className="vd-label">Estimated</div>
            <div className="vd-num font-bold">{formatHours(task.estimatedHours)}</div>
          </div>
          <div>
            <div className="vd-label">Completed</div>
            <div className="vd-num font-bold">{formatHours(task.completedHours)}</div>
          </div>
          <div>
            <div className="vd-label">Remaining</div>
            <div className="vd-num font-bold text-alarm">{formatHours(remaining)}</div>
          </div>
        </div>

        {task.description && (
          <p className="vd-num mt-3 border-t border-line pt-2 text-[11px] leading-relaxed text-muted">
            {task.description}
          </p>
        )}

        <div className="vd-label mt-3 text-[10px] text-muted">
          Risk & schedule recompute live when progress or status changes.
        </div>
      </div>
    </div>
  );
}
