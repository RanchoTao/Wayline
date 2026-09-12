"use client";

import { useEffect, useState } from "react";
import { useDaybook } from "@/store/daybook";
import { useWorkspace } from "@/store/workspace";
import { useNow } from "@/hooks/useNow";
import { taskName } from "@/lib/zh";
import { castWayfinding } from "@/lib/wayfinding";

export enum WorkspaceView {
  Today = "today",
  Plan = "plan",
  Review = "review",
  Oracle = "oracle",
}

const LABELS = { [WorkspaceView.Today]: "今日", [WorkspaceView.Plan]: "计划", [WorkspaceView.Review]: "回顾", [WorkspaceView.Oracle]: "问路 · 算一卦" };

export function WorkspaceMenu({ value, onChange }: { value: WorkspaceView; onChange: (view: WorkspaceView) => void }) {
  return <nav className="wayline-menu" aria-label="工作台菜单">
    {Object.values(WorkspaceView).map((view) => <button key={view} aria-current={value === view ? "page" : undefined} onClick={() => onChange(view)}>{LABELS[view]}</button>)}
  </nav>;
}

function localDate(time: number) {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function Daybook({ view }: { view: WorkspaceView }) {
  const { notes, selected, add, toggle, remove, select } = useDaybook();
  const project = useWorkspace((s) => s.project);
  const setProgress = useWorkspace((s) => s.setTaskProgress);
  const now = useNow(60_000);
  const date = localDate(now);
  const [draft, setDraft] = useState("");
  const [ready, setReady] = useState(false);
  const [reading, setReading] = useState<ReturnType<typeof castWayfinding> | null>(null);
  const [added, setAdded] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    Promise.resolve(useDaybook.persist.rehydrate()).then(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  const completed = notes.filter((n) => n.completedAt).sort((a, b) => b.completedAt!.localeCompare(a.completedAt!));
  const pending = notes.filter((n) => !n.completedAt);
  const planned = project?.tasks.filter((t) => selected.some((s) => s.projectId === project.id && s.taskId === t.id && s.date === date)) ?? [];
  const candidates = project?.tasks.filter((t) => t.status === "todo" || t.status === "in_progress") ?? [];
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || !draft.trim()) return;
    add(draft, date); setDraft(""); setNotice("已记入今日。");
  };

  return <main className="daybook-scroll">
    <div className="daybook-content">
      <header className="daybook-heading">
        <span className="wayline-eyebrow">{new Date(now).toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })}</span>
        <h2>{view === WorkspaceView.Today ? "今天，走好眼前这一段。" : view === WorkspaceView.Review ? "走过的路，都有迹可循。" : "不知从哪开始？问一问此刻。"}</h2>
        <p>{view === WorkspaceView.Today ? "先记下，再行动。不必一次走完整条路。" : view === WorkspaceView.Review ? "回看随手记录与完成的事情，给下一步一点方向。" : "借一个随机卦象换个角度想想，仅作娱乐与自我反思。"}</p>
      </header>
      {view === WorkspaceView.Today && <>
        <form className="daybook-capture" onSubmit={submit}>
          <input aria-label="快速记录" placeholder="把此刻想到的，先记下来…" maxLength={200} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button className="vd-btn wayline-primary" disabled={!ready || !draft.trim()}>记入今日 ↗</button>
        </form>
        <div className="daybook-columns">
          <section className="daybook-card"><h3>今天想做的事 <small>{pending.length + planned.filter((t) => t.status !== "done").length}</small></h3>
            {pending.length === 0 && planned.length === 0 && <p className="daybook-muted">写下一件小事，或从计划里选一段开始。</p>}
            {pending.map((n) => <div className="daybook-row" key={n.id}><button className="daybook-check" aria-label={`完成：${n.title}`} onClick={() => toggle(n.id)}>○</button><span>{n.title}<small>{n.date === date ? "今日记录" : "之前留下的待办"}</small></span><button className="daybook-delete" aria-label={`删除：${n.title}`} onClick={() => remove(n.id)}>×</button></div>)}
            {planned.map((t) => <div className="daybook-row" key={t.id}><button className="daybook-check" disabled={t.status === "cancelled" || t.status === "deferred"} aria-label={`${t.status === "done" ? "重新开始" : "完成"}：${taskName(t.title)}`} onClick={() => setProgress(t.id, t.status === "done" ? 0 : 1)}>{t.status === "done" ? "✓" : "○"}</button><span>{taskName(t.title)}<small>关联计划 · {Math.round(t.progress * 100)}% 完成</small></span><button className="daybook-delete" aria-label={`移出今日：${taskName(t.title)}`} onClick={() => select(project!.id, t.id, date)}>×</button></div>)}
          </section>
          <section className="daybook-card"><h3>从计划中挑选</h3><p className="daybook-muted">与时间线保持同步，完成后自动更新进度。</p>
            {!candidates.length && <p className="daybook-muted">前往“计划”创建目标，或加载示例。</p>}
            {candidates.map((t) => <label className="daybook-pick" key={t.id}><input type="checkbox" disabled={!ready} checked={planned.some((p) => p.id === t.id)} onChange={() => select(project!.id, t.id, date)} /><span>{taskName(t.title)}</span></label>)}
          </section>
        </div>
      </>}
      {view === WorkspaceView.Review && <section className="daybook-card">
        <h3>随手记回顾 <small>累计完成 {completed.length} 件 · 待办 {pending.length} 件</small></h3>
        {!completed.length && <p className="daybook-muted">还没有完成记录。去“今日”完成一件小事，再回来看看。</p>}
        {completed.map((n) => <div className="daybook-row" key={n.id}><span className="daybook-check">✓</span><span>{n.title}<small>{new Date(n.completedAt!).toLocaleString("zh-CN")} 完成</small></span><button className="vd-btn" onClick={() => toggle(n.id)}>撤销完成</button></div>)}
        <p className="daybook-muted">本次试用先记录“随手记”的完成时间；计划任务的历史回顾后续接入。</p>
      </section>}
      {view === WorkspaceView.Oracle && <section className="daybook-card daybook-oracle">
        {!reading ? <div className="oracle-empty" aria-hidden="true">☯</div> : <>
          <div className="oracle-lines" aria-label={`${reading.name}卦，六爻自下而上生成`}>
            {[...reading.lines].reverse().map((line, i) => <div className={`oracle-line ${line % 2 ? "yang" : "yin"}`} key={i}><i /><i />{(line === 6 || line === 9) && <b aria-label="动爻">·</b>}</div>)}
          </div>
          <h3>{reading.name}卦</h3><p>{reading.wisdom}</p><p className="daybook-muted">以三枚硬币法随机生成六爻，圆点标记动爻。</p>
          <div className="oracle-action"><small>不妨试试这件小事 · 随机灵感</small><strong>{reading.action}</strong>
            <button className="vd-btn wayline-primary" disabled={!ready || added} onClick={() => { add(reading.action, date); setAdded(true); setNotice("已加入今日，可在“今日”菜单查看。"); }}>{added ? "已加入今日 ✓" : "把这件事加入今日"}</button>
          </div>
        </>}
        <button className="vd-btn" onClick={() => { setReading(castWayfinding()); setAdded(false); setNotice(""); }}>{reading ? "再掷一卦" : "掷一卦，找点灵感"}</button>
      </section>}
      <p className="daybook-notice" role="status">{notice}</p>
    </div>
  </main>;
}
