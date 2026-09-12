"use client";

import { systemText } from "@/lib/zh";
import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/store/workspace";
import { isMockAgent } from "@/lib/pilotdeck/provider";
import { looksLikeConstraint } from "@/lib/agent/goalParser";

const EXAMPLES = [
  {
    label: "黑客松",
    goal: "9 月 20 日之前完成黑客松作品，我现在只有一个想法，需要完成产品设计、前端、PilotDeck Agent、测试、Demo 和答辩 PPT。",
  },
  {
    label: "研究论文",
    goal: "在会议截稿前完成关于智能计划调度的研究论文。",
  },
  {
    label: "考试复习",
    goal: "两周后参加机器学习考试，需要复习笔记、练习题目并完成模拟测试。",
  },
];

function Bubble({ msg }: { msg: { role: string; kind?: string; text: string } }) {
  const isAgent = msg.role === "agent";
  return (
    <div className={`vd-num whitespace-pre-wrap text-[11px] leading-relaxed ${isAgent ? "text-ink" : "text-alarm-dark"}`}>
      <span className="vd-label mr-1 text-[9px]">{isAgent ? "规划助手" : "你"}</span>
      {isAgent ? systemText(msg.text) : msg.text}
    </div>
  );
}

export function AgentPanel() {
  const project = useWorkspace((s) => s.project);
  const conversation = useWorkspace((s) => s.conversation);
  const thinking = useWorkspace((s) => s.thinking);
  const lastError = useWorkspace((s) => s.lastError);
  const generateFromGoal = useWorkspace((s) => s.generateFromGoal);
  const sendConstraint = useWorkspace((s) => s.sendConstraint);

  const [goal, setGoal] = useState("");
  const [deadline, setDeadline] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [conversation.length, thinking]);

  const submit = () => {
    const text = goal.trim();
    if (!text || thinking) return;
    if (project && looksLikeConstraint(text)) {
      void sendConstraint(text);
    } else {
      void generateFromGoal(text, deadline || null);
    }
    setGoal("");
    setDeadline("");
  };

  const fillExample = (g: string) => {
    setGoal(g);
    setDeadline("");
  };

  return (
    <aside className="wayline-agent-panel flex h-[70vh] min-h-0 flex-col border-r border-line bg-card md:h-auto">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="vd-label">规划助手</h2>
        <span className="vd-num text-[9px] text-faint">
          {isMockAgent() ? "本地规划助手" : "PILOTDECK"}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        {/* goal input */}
        <div>
          <label htmlFor="wayline-goal" className="vd-label mb-1 block">
            你想完成什么？
          </label>
          <textarea
            id="wayline-goal"
            className="vd-input h-20 w-full resize-none border border-line-strong bg-paper px-2 py-1.5 text-[12px] leading-relaxed outline-none focus:border-alarm"
            placeholder="告诉我你想完成什么，以及最后期限。"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
          />
          <div className="mt-1.5 flex items-center gap-2">
            <input
              type="datetime-local"
              aria-label="目标截止时间"
              className="vd-input min-w-0 flex-1 border border-line px-1.5 py-1 text-[11px]"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
            <button
              className="vd-btn shrink-0 border border-ink bg-ink px-3 py-1 text-[11px] font-bold text-white hover:bg-alarm hover:border-alarm disabled:opacity-40"
              onClick={submit}
              disabled={!goal.trim() || thinking}
            >
              {thinking ? "…" : project && looksLikeConstraint(goal) ? "调整计划" : "生成计划"}
            </button>
          </div>
          <div className="vd-label mt-1 text-[9px] text-faint">
            {project
              ? "输入“今天只剩 3 小时”等变化，可自动调整计划。"
              : "截止时间选填，默认为 7 天后。"}
          </div>
        </div>

        {/* examples */}
        <div>
          <div className="vd-label mb-1">试试这些目标</div>
          <div className="flex gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                className="vd-btn border border-line-strong px-2 py-1 text-[10px] font-bold text-ink-soft hover:border-ink hover:text-ink"
                onClick={() => fillExample(ex.goal)}
              >
                {ex.label.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* conversation */}
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto border-t border-line pt-2">
          <div className="vd-label mb-1 text-[9px] text-faint">对话记录</div>
          {conversation.length === 0 && (
            <div className="vd-num mt-6 text-center text-[11px] leading-relaxed text-faint">
              还没有计划。
              <br />
              加载示例，或写下你的目标。
            </div>
          )}
          <div className="flex flex-col gap-2.5">
            {conversation.map((m) => (
              <Bubble key={m.id} msg={m} />
            ))}
            {thinking && (
              <div className="vd-label vd-blink text-alarm">
                正在规划… 理解目标 → 拆解任务 → 安排时间 → 评估风险
              </div>
            )}
          </div>
          {lastError && (
            <div className="vd-num mt-2 border border-alarm bg-alarm-soft px-2 py-1 text-[11px] text-alarm-dark">
              操作未完成：{systemText(lastError)}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
