import assert from "node:assert/strict";
import test from "node:test";
import { materializeCapture } from "../src/domain/capture";
import { buildWaylineDemo } from "../src/domain/demo";
import { migrateLegacyProject } from "../src/domain/migrations";
import type { Capture, WaylineProject, WaylineTask } from "../src/domain/models";
import { analyzeTask, matrixQuadrant, priorityScore, taskPressure, topTasks, urgencyWeight } from "../src/domain/priority/engine";
import { computeReviewStatistics } from "../src/domain/review";
import { MockCaptureProvider } from "../src/lib/ai/mock";
import { buildHackathonDemo } from "../src/lib/demo/hackathon";

const NOW = Date.parse("2026-09-12T02:00:00.000Z");
const task = (overrides: Partial<WaylineTask> = {}): WaylineTask => ({
  id: overrides.id ?? crypto.randomUUID(), title: "测试任务", createdAt: new Date(NOW).toISOString(), deadline: new Date(NOW + 86_400_000).toISOString(), importance: 8, progress: 0, status: "ready", actionable: true, dependencies: [], source: "manual", createdByAI: false, ...overrides,
});

test("preserves VisualDeadline urgency buckets and pressure formula", () => {
  assert.equal(urgencyWeight(new Date(NOW - 1).toISOString(), NOW), 7);
  assert.equal(urgencyWeight(new Date(NOW + 60 * 60_000).toISOString(), NOW), 6);
  assert.equal(urgencyWeight(new Date(NOW + 24 * 60 * 60_000).toISOString(), NOW), 4);
  assert.equal(urgencyWeight(new Date(NOW + 40 * 86_400_000).toISOString(), NOW), 0.75);
  const sample = task({ importance: 8, progress: 25, deadline: new Date(NOW + 86_400_000).toISOString() });
  assert.equal(taskPressure(sample, NOW), 24);
  assert.equal(priorityScore(sample, NOW), 248);
});

test("assigns all four matrix quadrants from the same engine", () => {
  assert.equal(matrixQuadrant(task({ importance: 10, deadline: new Date(NOW + 86_400_000).toISOString() }), NOW), "I");
  assert.equal(matrixQuadrant(task({ importance: 10, deadline: new Date(NOW + 60 * 86_400_000).toISOString() }), NOW), "II");
  assert.equal(matrixQuadrant(task({ importance: 2, deadline: new Date(NOW + 86_400_000).toISOString() }), NOW), "III");
  assert.equal(matrixQuadrant(task({ importance: 2, deadline: new Date(NOW + 60 * 86_400_000).toISOString() }), NOW), "IV");
});

test("Top 3 uses VisualDeadline priority ordering, not deadline-only ordering", () => {
  const urgentLow = task({ id: "urgent-low", importance: 2, deadline: new Date(NOW + 3_600_000).toISOString() });
  const urgentHigh = task({ id: "urgent-high", importance: 10, deadline: new Date(NOW + 86_400_000).toISOString() });
  const longLow = task({ id: "long-low", importance: 2, deadline: new Date(NOW + 183 * 86_400_000).toISOString() });
  assert.deepEqual(topTasks([urgentLow, longLow, urgentHigh], NOW).map((item) => item.id), ["urgent-high", "urgent-low", "long-low"]);
});

test("Top 3 exposes executable prerequisites instead of blocked descendants", () => {
  const prerequisite = task({ id: "prerequisite", importance: 7 });
  const blocked = task({ id: "blocked", importance: 10, dependencies: ["prerequisite"] });
  assert.deepEqual(topTasks([blocked, prerequisite], NOW).map((item) => item.id), ["prerequisite"]);
});

test("startAfter in the future excludes a task from Top 3 candidates", () => {
  const now = NOW;
  const future = task({ id: "future", importance: 10, startAfter: new Date(now + 7 * 86_400_000).toISOString() });
  const ready = task({ id: "ready", importance: 5 });
  const list = topTasks([future, ready], now);
  assert.deepEqual(list.map((item) => item.id), ["ready"]);
  assert.ok(!list.some((item) => item.id === "future"), "future-startAfter task must be filtered from candidates");
  // past startAfter is eligible
  const past = task({ id: "past", importance: 9, startAfter: new Date(now - 86_400_000).toISOString() });
  assert.deepEqual(topTasks([future, past], now).map((item) => item.id), ["past"]);
});

test("wayline demo spreads across all four quadrants with an executable Top 3", () => {
  const { projects, tasks } = buildWaylineDemo(NOW);
  assert.equal(projects.length, 1);
  assert.ok(tasks.length >= 9, `demo should be rich, got ${tasks.length}`);
  const quadrants = new Set(tasks.map((item) => analyzeTask(item, tasks, NOW).matrixPosition.quadrant));
  for (const q of ["I", "II", "III", "IV"] as const) assert.ok(quadrants.has(q), `demo missing quadrant ${q}`);
  const top = topTasks(tasks, NOW);
  assert.equal(top.length, 3);
  for (const item of top) {
    const analysis = analyzeTask(item, tasks, NOW);
    assert.ok(!analysis.blocked, `${item.title} must not be blocked in Top 3`);
  }
  // a blocked high-priority task still exists in demo for honest display
  const blockedHigh = tasks.some((item) => analyzeTask(item, tasks, NOW).blocked && item.importance >= 9);
  assert.ok(blockedHigh, "demo should include a blocked high-importance task for display");
});

test("large exam goal is decomposed; scoped exercise remains one actionable task", async () => {
  const provider = new MockCaptureProvider();
  const project = await provider.understand({ inputType: "text", text: "我要准备两周后的机器学习考试，考试范围 1-8 章。" }, NOW);
  assert.equal(project.intent, "project");
  assert.equal(project.actionable, false);
  assert.equal(project.suggestedTasks.length, 8);
  const direct = await provider.understand({ inputType: "text", text: "今天晚上把第三章习题 1-10 做完。" }, NOW);
  assert.equal(direct.intent, "task");
  assert.equal(direct.actionable, true);
  assert.equal(direct.suggestedTasks.length, 1);
});

test("materialized project keeps a non-actionable parent and executable dependent leaves", async () => {
  const result = await new MockCaptureProvider().understand({ inputType: "text", text: "我要准备两周后的机器学习考试，考试范围 1-8 章。" }, NOW);
  const capture: Capture = { id: "capture-1", createdAt: new Date(NOW).toISOString(), status: "pending", inputType: "text", rawInput: result.rawInput, result };
  let id = 0;
  const created = materializeCapture(capture, new Date(NOW).toISOString(), (prefix) => `${prefix}-${++id}`);
  assert.equal(created.projects.length, 1);
  assert.equal(created.tasks.filter((item) => !item.actionable).length, 1);
  assert.equal(created.tasks.filter((item) => item.actionable).length, 8);
  assert.ok(created.tasks.slice(2).every((item) => item.dependencies.length === 1));
});

test("completing Top 1 removes it and automatically promotes the next task", () => {
  const tasks = [task({ id: "one", importance: 10 }), task({ id: "two", importance: 8 }), task({ id: "three", importance: 7 }), task({ id: "four", importance: 6 })];
  assert.equal(topTasks(tasks, NOW)[0].id, "one");
  const completed = tasks.map((item) => item.id === "one" ? { ...item, status: "done" as const, progress: 100 } : item);
  assert.deepEqual(topTasks(completed, NOW).map((item) => item.id), ["two", "three", "four"]);
});

test("deadline change updates urgency, matrix position and priority together", () => {
  const later = task({ importance: 8, deadline: new Date(NOW + 183 * 86_400_000).toISOString() });
  const before = analyzeTask(later, [later], NOW);
  const sooner = { ...later, deadline: new Date(NOW + 86_400_000).toISOString() };
  const after = analyzeTask(sooner, [sooner], NOW);
  assert.ok(after.urgency > before.urgency);
  assert.ok(after.priority > before.priority);
  assert.notEqual(after.matrixPosition.quadrant, before.matrixPosition.quadrant);
});

test("review statistics are calculated only from real task timestamps", () => {
  const project: WaylineProject = { id: "p", title: "机器学习考试准备", createdAt: new Date(NOW - 2 * 86_400_000).toISOString(), importance: 8, status: "active" };
  const tasks = [task({ id: "done", projectId: "p", status: "done", progress: 100, completedAt: new Date(NOW - 3_600_000).toISOString(), estimatedMinutes: 50, completedMinutes: 80 }), task({ id: "late", projectId: "p", deadline: new Date(NOW - 86_400_000).toISOString(), status: "ready" }), task({ id: "deferred", projectId: "p", status: "deferred" })];
  const stats = computeReviewStatistics(tasks, [project], "7d", NOW);
  assert.equal(stats.completedTasks, 1);
  assert.equal(stats.deferredTasks, 2);
  assert.equal(stats.biggestProgressProject, "机器学习考试准备");
  assert.equal(stats.mostDeferredProject, "机器学习考试准备");
  assert.equal(stats.estimateVarianceMinutes, 30);
});

test("legacy vd-workspace project migrates without dropping task identity", () => {
  const legacy = buildHackathonDemo(NOW);
  const migrated = migrateLegacyProject(legacy);
  assert.equal(migrated.projects[0].id, legacy.id);
  assert.equal(migrated.tasks.length, legacy.tasks.length);
  assert.equal(migrated.tasks[0].id, legacy.tasks[0].id);
  assert.equal(migrated.tasks[0].progress, Math.round(legacy.tasks[0].progress * 100));
});
