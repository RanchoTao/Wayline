import type { Project, RiskInfo, RiskLevel, Task } from "./types";
import { HOUR_MS, clamp, clamp01, parseIso } from "./time";

export interface ProjectMetrics {
  totalMs: number;
  elapsedMs: number;
  remainingMs: number;
  elapsedRatio: number; // 0..1
  remainingRatio: number; // 0..1
  expectedProgress: number; // = elapsedRatio
  actualProgress: number; // work done by hours
  scheduleGap: number; // actual - expected (fraction, negative = behind)
  scheduleGapHours: number;
  timeUsedPercent: number;
  workDonePercent: number;
  requiredHours: number; // remaining estimated work
  availableHours: number; // remaining effective working time
  capacityRatio: number; // required / available
  criticalIncomplete: number; // fraction of critical tasks not done
  doneHours: number;
  totalHours: number;
}

export function isWorkTask(t: Task): boolean {
  return t.status !== "cancelled" && t.status !== "deferred";
}

export function taskWorkDone(t: Task): number {
  if (t.status === "done") return t.estimatedHours;
  return clamp01(t.progress) * t.estimatedHours;
}

export function computeMetrics(project: Project, now: number): ProjectMetrics {
  const t0 = parseIso(project.createdAt);
  const t1 = parseIso(project.deadline);
  const totalMs = Math.max(1, t1 - t0);
  const elapsedMs = clamp(now - t0, 0, totalMs);
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const elapsedRatio = elapsedMs / totalMs;
  const remainingRatio = 1 - elapsedRatio;

  const workTasks = project.tasks.filter(isWorkTask);
  const totalHours = workTasks.reduce((s, t) => s + t.estimatedHours, 0);
  const doneHours = workTasks.reduce((s, t) => s + taskWorkDone(t), 0);
  const actualProgress = totalHours > 0 ? doneHours / totalHours : 0;

  // remaining work (excluding hours already banked on incomplete tasks)
  const requiredHours = workTasks.reduce((s, t) => {
    if (t.status === "done") return s;
    return s + Math.max(0, t.estimatedHours - taskWorkDone(t));
  }, 0);

  // effective available time: today's capacity + full remaining days * daily capacity
  const remainingHours = remainingMs / HOUR_MS;
  const fullDaysAfterToday = Math.max(0, remainingHours / 24 - 1);
  const availableHours = Math.max(
    0,
    project.todayCapacityHours + project.dailyCapacityHours * fullDaysAfterToday
  );

  const capacityRatio = availableHours > 0 ? requiredHours / availableHours : 99;

  const expectedProgress = elapsedRatio;
  const scheduleGap = actualProgress - expectedProgress;
  // gap expressed in hours of *work* (gap fraction × total planned work)
  const scheduleGapHours = scheduleGap * totalHours;

  const criticalTotal = project.tasks.filter((t) => t.isCritical).length;
  // critical tasks that have not even started (true bottleneck territory)
  const criticalIncomplete = criticalTotal
    ? project.tasks.filter((t) => t.isCritical && t.status === "todo").length /
      criticalTotal
    : 0;

  return {
    totalMs,
    elapsedMs,
    remainingMs,
    elapsedRatio,
    remainingRatio,
    expectedProgress,
    actualProgress,
    scheduleGap,
    scheduleGapHours,
    timeUsedPercent: elapsedRatio,
    workDonePercent: actualProgress,
    requiredHours,
    availableHours,
    capacityRatio,
    criticalIncomplete,
    doneHours,
    totalHours,
  };
}

/**
 * Deterministic local risk engine (spec section 18).
 * score = 0.30 * behind-deficit
 *       + 0.35 * capacity pressure ((ratio-1)/0.5, clamped)
 *       + 0.25 * critical tasks not started
 *       + 0.10 * time already consumed
 * clamped to 0..1.
 */
export function computeRisk(
  project: Project,
  now: number,
  metrics?: ProjectMetrics
): RiskInfo {
  const m = metrics ?? computeMetrics(project, now);

  const deficit = clamp01(-m.scheduleGap);
  const capacityPressure = clamp01((m.capacityRatio - 1) / 0.5);
  const timePressure = m.elapsedRatio;

  const score = clamp01(
    0.3 * deficit + 0.35 * capacityPressure + 0.25 * m.criticalIncomplete +
      0.1 * timePressure
  );

  const level: RiskLevel =
    score < 0.3 ? "LOW" : score < 0.6 ? "MEDIUM" : score < 0.8 ? "HIGH" : "CRITICAL";

  const reasons: string[] = [];
  if (m.scheduleGap < 0) {
    reasons.push(
      `Behind schedule by ${Math.abs(m.scheduleGapHours).toFixed(1)}h (${(
        m.scheduleGap * 100
      ).toFixed(0)}% gap)`
    );
  }
  if (m.capacityRatio > 1) {
    reasons.push(
      `Remaining work (${m.requiredHours.toFixed(1)}h) exceeds effective time (${m.availableHours.toFixed(1)}h)`
    );
  }
  if (m.criticalIncomplete > 0) {
    reasons.push(
      `${Math.round(m.criticalIncomplete * 100)}% of critical-path tasks not started`
    );
  }
  if (reasons.length === 0) reasons.push("On track against deadline");

  return {
    score,
    level,
    reasons,
    scheduleGapHours: m.scheduleGapHours,
    expectedProgress: m.expectedProgress,
    actualProgress: m.actualProgress,
    requiredHours: m.requiredHours,
    availableHours: m.availableHours,
    capacityRatio: m.capacityRatio,
    criticalIncomplete: m.criticalIncomplete,
  };
}

export function riskLevelOf(score: number): RiskLevel {
  return score < 0.3 ? "LOW" : score < 0.6 ? "MEDIUM" : score < 0.8 ? "HIGH" : "CRITICAL";
}
