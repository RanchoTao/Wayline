/**
 * Headless verification of the agent pipeline + demo scenario.
 * Run: npx tsx scripts/verify.ts
 */
import { buildHackathonDemo, demoInsight } from "../src/lib/demo/hackathon";
import { replanProject, parseConstraint } from "../src/lib/agent/replanner";
import { generatePlan } from "../src/lib/agent/pipeline";
import { computeMetrics, computeRisk } from "../src/lib/metrics";
import { parseIso } from "../src/lib/time";

const FIXED_NOW = Date.parse("2026-09-11T09:00:00Z");

function check(cond: boolean, label: string) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) process.exitCode = 1;
}

console.log("=== DEMO SCENARIO (fixed now) ===");
const demo = buildHackathonDemo(FIXED_NOW);
const m = computeMetrics(demo, FIXED_NOW);
const risk = computeRisk(demo, FIXED_NOW);
const insight = demoInsight(demo, FIXED_NOW);

console.log(
  `timeUsed=${(m.timeUsedPercent * 100).toFixed(1)}% workDone=${(m.workDonePercent * 100).toFixed(1)}% gap=${m.scheduleGapHours.toFixed(1)}h required=${m.requiredHours.toFixed(1)}h available=${m.availableHours.toFixed(1)}h ratio=${m.capacityRatio.toFixed(2)}`
);
console.log(`risk=${risk.score.toFixed(3)} level=${risk.level} reasons=${risk.reasons.join(" | ")}`);
console.log(`bottleneck=${insight.insight.bottleneck} | status=${insight.insight.statusText}`);
console.log(`action=${insight.insight.recommendedAction}`);
console.log(`milestones=${demo.milestones.length} tasks=${demo.tasks.length}`);

check(m.timeUsedPercent > 0.64 && m.timeUsedPercent < 0.66, "TIME USED ≈ 65%");
check(Math.abs(m.workDonePercent - 0.42) < 0.005, "WORK DONE = 42%");
check(m.scheduleGap < 0, "BEHIND SCHEDULE (gap < 0)");
check(risk.level === "HIGH" || risk.level === "MEDIUM", "risk level plausible");
check(demo.tasks.every((t) => parseIso(t.start) >= parseIso(demo.createdAt) - 1000), "no task starts before createdAt");
check(demo.tasks.every((t) => parseIso(t.end) <= parseIso(demo.deadline) + 1000), "no task ends after deadline");

// in-progress bars should straddle `now`
const inProg = demo.tasks.filter((t) => t.status === "in_progress");
check(inProg.length >= 2, "demo has in-progress tasks");
check(
  inProg.every((t) => parseIso(t.start) <= FIXED_NOW && parseIso(t.end) > FIXED_NOW),
  "in-progress bars cross the NOW line"
);

console.log("\n=== REPLAN: 'I only have 3 hours today' ===");
const rc = parseConstraint("I only have 3 hours today");
console.log("parsed:", JSON.stringify(rc));
check(rc.todayCapacityHours === 3, "constraint → todayCapacityHours = 3");

const rp = replanProject(demo, "I only have 3 hours today", FIXED_NOW);
const rm = computeMetrics(rp.project, FIXED_NOW);
const rrisk = computeRisk(rp.project, FIXED_NOW);
console.log(
  `after: required=${rm.requiredHours.toFixed(1)}h available=${rm.availableHours.toFixed(1)}h ratio=${rm.capacityRatio.toFixed(2)}`
);
console.log(`after risk=${rrisk.score.toFixed(3)} level=${rrisk.level}`);
console.log("explanation:\n" + rp.explanation);
console.log(`changedTaskIds=${rp.changedTaskIds.length}`);

const cancelled = rp.project.tasks.filter((t) => t.status === "cancelled").map((t) => t.title);
const deferred = rp.project.tasks.filter((t) => t.status === "deferred").map((t) => t.title);
const focused = rp.project.tasks.find((t) => t.id === "t_pilotdeck_integration");
console.log(`cancelled=${cancelled.join(",")} deferred=${deferred.join(",")} pilotdeck.status=${focused?.status}`);
check(cancelled.includes("Landing Page"), "Landing Page cancelled");
check(deferred.includes("Visual Polish"), "Visual Polish deferred");
check(focused?.status === "in_progress", "PilotDeck Integration started");
check(rp.changedTaskIds.length > 3, "replan touched several tasks");
check(
  rp.project.tasks.every((t) => parseIso(t.end) <= parseIso(demo.deadline) + 1000),
  "replanned tasks still end before deadline"
);

console.log("\n=== GOAL PARSE (Chinese input) ===");
const g = generatePlan(
  "9 月 20 日之前完成黑客松作品，我现在只有一个想法，需要完成产品设计、前端、PilotDeck Agent、测试、Demo 和答辩 PPT。",
  { now: FIXED_NOW }
);
console.log(
  `title="${g.project.title}" deadline=${new Date(g.project.deadline).toISOString()} tasks=${g.project.tasks.length} intent-ok`
);
check(g.project.deadline.startsWith("2026-09-20"), "deadline parsed as 2026-09-20");
check(g.project.tasks.length >= 8, "hackathon plan has 8+ tasks");
check(
  g.project.tasks.every((t) => parseIso(t.end) <= parseIso(g.project.deadline) + 1000),
  "generated plan fits before deadline"
);

console.log("\n=== GOAL PARSE (no deadline) ===");
const g2 = generatePlan("Build a research paper on agentic scheduling.", { now: FIXED_NOW });
console.log(`deadline=${new Date(g2.project.deadline).toISOString()} (should be +7d)`);
check(g2.project.deadline === new Date(FIXED_NOW + 7 * 86400000).toISOString(), "default deadline = +7 days");

console.log("\nDone.");
