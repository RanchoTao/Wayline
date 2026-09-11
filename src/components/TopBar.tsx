"use client";

import { useMemo, useRef, useState } from "react";
import { useWorkspace } from "@/store/workspace";
import { useNow } from "@/hooks/useNow";
import { computeMetrics, computeRisk } from "@/lib/metrics";
import { formatCountdown, formatDeadline, formatPct } from "@/lib/format";
import { parseIso, toIso } from "@/lib/time";
import { RiskBadge } from "./RiskBadge";

export function TopBar() {
  const project = useWorkspace((s) => s.project);
  const loadDemo = useWorkspace((s) => s.loadDemo);
  const reset = useWorkspace((s) => s.reset);
  const exportJson = useWorkspace((s) => s.exportJson);
  const importJson = useWorkspace((s) => s.importJson);
  const setDeadline = useWorkspace((s) => s.setDeadline);
  const now = useNow(1000);

  const [editingDeadline, setEditingDeadline] = useState(false);
  const [deadlineDraft, setDeadlineDraft] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const m = useMemo(
    () => (project ? computeMetrics(project, now) : null),
    [project, now]
  );
  const risk = useMemo(
    () => (project ? computeRisk(project, now) : null),
    [project, now]
  );

  const countdown = project
    ? formatCountdown(parseIso(project.deadline) - now)
    : "— — — —";

  const handleDeadlineSave = () => {
    if (deadlineDraft) setDeadline(new Date(deadlineDraft).toISOString());
    setEditingDeadline(false);
  };

  const handleImport = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = importJson(String(reader.result ?? ""));
      if (!ok) alert("Import failed: not a VisualDeadline export.");
    };
    reader.readAsText(file);
  };

  return (
    <header className="flex h-auto min-h-14 shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-card px-4 py-1.5 md:h-14 md:flex-nowrap md:py-0">
      {/* brand */}
      <div className="flex items-baseline gap-2 whitespace-nowrap">
        <h1 className="vd-num text-[14px] font-black tracking-[0.08em] text-ink md:text-[17px]">
          VISUALDEADLINE
        </h1>
        <span className="vd-label text-alarm">AGENT</span>
      </div>

      {/* countdown — the heartbeat */}
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="flex items-baseline gap-2">
          <span
            className={`vd-num text-[20px] font-black tracking-tight md:text-[26px] ${
              countdown.startsWith("00D") ? "vd-pulse text-alarm" : "text-alarm"
            }`}
          >
            {countdown}
          </span>
          <span className="vd-label">LEFT</span>
        </div>

        {/* deadline (click to edit) */}
        {project &&
          (editingDeadline ? (
            <div className="flex items-center gap-1.5">
              <input
                type="datetime-local"
                className="vd-input border border-line-strong px-1.5 py-0.5"
                value={deadlineDraft}
                onChange={(e) => setDeadlineDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleDeadlineSave()}
              />
              <button className="vd-btn border border-alarm px-1.5 py-0.5 text-alarm" onClick={handleDeadlineSave}>
                SET
              </button>
            </div>
          ) : (
            <button
              className="vd-label cursor-pointer underline decoration-dotted underline-offset-4 hover:text-alarm"
              onClick={() => {
                setDeadlineDraft(toIso(parseIso(project.deadline)).slice(0, 16));
                setEditingDeadline(true);
              }}
              title="Edit deadline — remaining time, expected progress and risk recompute"
            >
              {formatDeadline(project.deadline)}
            </button>
          ))}
      </div>

      {/* right metrics + actions */}
      <div className="flex items-center gap-3 whitespace-nowrap">
        {project && m && (
          <div className="hidden items-center gap-3 md:flex">
            <div className="vd-num text-[12px] font-bold text-ink">
              {formatPct(m.workDonePercent)}{" "}
              <span className="vd-label">COMPLETE</span>
            </div>
            {risk && <RiskBadge project={project} now={now} />}
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            handleImport(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />

        <button
          className="vd-btn border border-ink bg-ink px-2.5 py-1 text-white hover:bg-alarm hover:border-alarm"
          onClick={loadDemo}
          title="One-click demo story: 65% time used, 42% work done, behind schedule"
        >
          LOAD HACKATHON DEMO
        </button>
        {project && (
          <>
            <button
              className="vd-btn hidden border border-line-strong px-2 py-1 text-ink-soft hover:border-ink hover:text-ink md:inline-block"
              onClick={() => fileRef.current?.click()}
              title="Import a JSON export"
            >
              IMPORT
            </button>
            <button
              className="vd-btn hidden border border-line-strong px-2 py-1 text-ink-soft hover:border-ink hover:text-ink md:inline-block"
              onClick={() => {
                const blob = new Blob([exportJson()], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "visualdeadline-export.json";
                a.click();
                URL.revokeObjectURL(url);
              }}
              title="Export workspace as JSON"
            >
              EXPORT
            </button>
            <button
              className="vd-btn border border-line-strong px-2 py-1 text-muted hover:border-alarm hover:text-alarm"
              onClick={reset}
              title="Clear workspace"
            >
              RESET
            </button>
          </>
        )}
      </div>
    </header>
  );
}
