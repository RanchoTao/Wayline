import type { Task } from "./types";

export const taskStatusText: Record<Task["status"], string> = {
  todo: "待开始", in_progress: "进行中", done: "已完成", deferred: "已延期", cancelled: "已取消",
};
export const riskText: Record<string, string> = {
  LOW: "低风险", MEDIUM: "中风险", HIGH: "高风险", CRITICAL: "严重风险",
};
export const priorityText: Record<Task["priority"], string> = {
  low: "低优先级", medium: "中优先级", high: "高优先级", critical: "关键优先级",
};

const taskNames: Record<string, string> = {
  "Product Definition": "产品定义", "UI Prototype": "界面原型", "Core Timeline": "核心时间线",
  "PilotDeck Integration": "PilotDeck 接入", "Risk Engine": "风险评估", "Testing": "测试验证",
  "Demo Video": "演示视频", "Presentation": "答辩展示", "Landing Page": "产品介绍页", "Visual Polish": "视觉优化",
  "Related Work": "相关研究", "Problem Statement": "研究问题", "Method Design": "方法设计",
  "Implementation": "系统实现", "Experiments": "实验验证", "Analysis": "结果分析", "Write Up": "论文撰写", "Final Submission": "最终提交",
  "Syllabus Scan": "梳理考纲", "Concept Notes": "知识笔记", "Problem Sets": "习题练习", "Mock Exams": "模拟考试", "Error Review": "错题复盘", "Final Pass": "考前复习",
  "Define Scope": "明确范围", "Research & Gather": "资料收集", "Draft Core": "完成初稿", "Review & Iterate": "评审迭代", "Finalize": "完善交付",
};

const descriptions: Record<string, string> = {
  "Define the one-line pitch, target user, demo story and scope boundaries.": "明确产品定位、目标用户、演示流程与范围。",
  "Figma / HTML prototype of the core screen and the key interaction flow.": "制作核心页面与关键交互流程的 Figma / HTML 原型。",
  "Deadline timeline, countdown, progress vs time, schedule gap visualization.": "实现截止时间线、倒计时，以及进度与时间偏差的可视化。",
  "Wire the agent adapter so goals become structured plans inside the app.": "接入规划助手，将目标转化为应用内的结构化计划。",
  "Deterministic risk scoring + agent insight panel with APPLY PLAN.": "实现风险评分、计划洞察与新计划应用功能。",
  "Walk the full demo flow, fix console errors, verify persistence and build.": "验证完整演示流程，修复错误，检查数据保存和构建。",
  "Record a 3-minute story: vague goal -> plan -> constraint -> replan.": "录制 3 分钟演示：从目标到计划，再根据限制调整安排。",
  "Pitch deck: problem, insight, agent loop, live demo, ask.": "制作答辩材料：问题、洞察、规划流程、现场演示与诉求。",
  "Marketing page for the product. Nice-to-have, non-critical.": "制作产品介绍页，属于非关键的可选任务。",
  "Animations, micro-interactions and edge-case styling.": "完善动画、微交互与边界状态样式。",
  "Survey 10-15 relevant papers and position the gap.": "阅读 10 至 15 篇相关论文，明确研究空白。",
  "Formalize the research question and success metric.": "明确研究问题与评估指标。",
  "Define approach, architecture and baselines.": "设计研究方法、系统架构与对照基线。",
  "Build the system and instrument experiments.": "实现系统并准备实验环境。",
  "Run baselines and ablations, collect results.": "进行基线和消融实验，收集结果。",
  "Tables, figures, error analysis, limitations.": "整理图表、误差分析与局限性。",
  "Draft full paper, revise with advisor feedback.": "完成论文初稿，并根据导师反馈修改。",
  "Format, proofread, submit to venue.": "调整格式、校对并提交论文。",
  "List topics, weights and past papers coverage.": "梳理考试主题、分值权重与历年真题。",
  "Condensed notes per topic with formula sheets.": "整理各主题的精简笔记与公式表。",
  "50 representative problems, worked in full.": "完整练习 50 道代表性题目。",
  "3 timed mock exams under exam conditions.": "按考试要求完成 3 次限时模拟。",
  "Categorize mistakes, re-drill weak topics.": "归类错题，针对薄弱主题强化练习。",
  "One full pass over formula sheet + weak topics.": "完整复习公式表与薄弱知识点。",
  "Clarify the outcome, quality bar and what is out of scope.": "明确交付成果、质量标准与范围边界。",
  "Collect inputs, references and constraints.": "收集资料、参考与限制条件。",
  "Produce the main deliverable in its rough form.": "完成主要交付成果的初稿。",
  "Feedback loop and revisions.": "收集反馈并迭代修改。",
  "Polish, proofread, package the deliverable.": "完善、校对并整理交付成果。",
  "Pitch, scope and demo story locked with the team.": "与团队确认产品定位、范围与演示流程。",
  "Core screen + key interaction flow prototyped.": "完成核心页面与关键交互流程原型。",
  "Deadline timeline, countdown, progress vs time visualization.": "实现截止时间线、倒计时与时间进度对比。",
  "Agent adapter: goals become structured plans inside the app.": "接入规划助手，在应用内将目标转化为结构化计划。",
  "Deterministic risk scoring + agent insight panel.": "实现风险评分与计划洞察面板。",
  "Full demo walk, console fixes, persistence + build check.": "验证演示流程、修复错误、检查数据保存与构建。",
  "3-minute story: vague goal → plan → constraint → replan.": "3 分钟演示：目标 → 计划 → 新限制 → 调整计划。",
  "Pitch deck for the judges.": "制作面向评委的答辩材料。",
  "Marketing page. Nice-to-have, non-critical.": "制作产品介绍页，属于非关键的可选任务。",
  "Animations and micro-interactions. Non-critical.": "完善动画与微交互，属于非关键任务。"
};

/** Translate built-in labels at display time; preserve stored IDs and custom text. */
export function taskName(text: string): string {
  return taskNames[text] ?? text;
}

/** Compatibility for system explanations already persisted by the English demo. Never use on user messages. */
export function systemText(text: string): string {
  let result = (descriptions[text] ?? text)
    .replace(/Hackathon demo loaded\. 10 days, 10 tasks, 65% of the time gone, 42% of the work done\./g, "示例计划已加载：共 10 天、10 项任务，时间已消耗 65%，任务已完成 42%。")
    .replace(/Agent reads this as BEHIND SCHEDULE\. Tell it a constraint — e\.g\. "I only have 3 hours today"\./g, "当前进度落后。试着告诉我新的限制，例如“今天只有 3 小时”。")
    .replace(/Plan ready — (\d+) tasks to the deadline\./g, "计划已生成，截止前需完成 $1 项任务。")
    .replace(/Replan ready \((\d+) tasks affected\)\./g, "调整方案已就绪，涉及 $1 项任务。")
    .replace(/PLAN APPLIED — timeline, priorities and risk updated\. Risk (recomputed|unchanged)\./g, "新计划已应用，时间线、优先级与风险已更新。")
    .replace(/Constraint detected: /g, "已识别限制：")
    .replace(/Available time today/g, "今日可用工时")
    .replace(/Deadline extracted from your goal: /g, "已从目标识别截止时间：")
    .replace(/No explicit deadline found — assumed 7 days out\. You can change it in the top bar\./g, "未指定截止时间，默认安排在 7 天后，可在顶部修改。")
    .replace(/Behind schedule by ([\d.]+)h/g, "进度落后 $1 小时")
    .replace(/Ahead of schedule by ([\d.]+)h/g, "进度领先 $1 小时")
    .replace(/\(([-\d.]+)% gap\)/g, "（偏差 $1%）")
    .replace(/Remaining work \(([\d.]+)h\) exceeds effective time \(([\d.]+)h\)/g, "待完成工作需要 $1 小时，超出可用的 $2 小时")
    .replace(/(\d+)% of critical-path tasks not started/g, "$1% 的关键任务尚未开始")
    .replace(/On track against deadline/g, "当前进度符合计划")
    .replace(/All critical work is either done or in progress\./g, "所有关键任务均已完成或正在进行。")
    .replace(/(.+) (?:all depend|depends) on it\./g, "$1 需要先完成此任务。")
    .replace(/(.+) is the largest chunk of remaining work\./g, "$1 是剩余工作中最主要的任务。")
    .replace(/Stop polishing "(.+)"\. Finish "(.+)" first\./g, "暂停优化“$1”，优先完成“$2”。")
    .replace(/Push "(.+)" to done next\./g, "接下来优先完成“$1”。")
    .replace(/Next: finish "(.+)"\./g, "下一步：完成“$1”。")
    .replace(/All remaining tasks are non-critical; hold the schedule\./g, "剩余任务均非关键任务，按当前计划推进即可。")
    .replace(/Dropped /g, "取消 ")
    .replace(/Postponed polish\/animation work and cut its budget 50%/g, "延期视觉优化，并减少 50% 的工时")
    .replace(/"(.+)" moved to critical path and started/g, "“$1”已提升为关键任务并开始执行")
    .replace(/Demo & presentation slots protected/g, "保留演示与答辩时间")
    .replace(/"(.+)" overran by ([\d.]+)h — absorbed into its existing slot/g, "“$1”超时 $2 小时，已在原时段内调整")
    .replace(/No actionable constraint detected — schedule unchanged\./g, "未识别到可执行的限制，计划保持不变。")
    .replace(/\[(CONSTRAINT|CANCEL|DEFER|PRIORITIZE|RESERVE|ABSORB)\]/g, (_, action: string) => `[${({ CONSTRAINT: "限制", CANCEL: "取消", DEFER: "延期", PRIORITIZE: "优先", RESERVE: "保留", ABSORB: "调整" } as Record<string, string>)[action]}]`)
    .replace(/Plan locked/g, "计划确认").replace(/Ready for deadline/g, "准备交付")
    .replace(/Build complete/g, "开发完成").replace(/Demo ready/g, "演示就绪")
    .replace(/([\d.]+)h\b/g, "$1 小时");
  for (const [en, zh] of Object.entries(taskNames)) result = result.replaceAll(en, zh);
  return result.replace(/ done\b/g, "已完成");
}
