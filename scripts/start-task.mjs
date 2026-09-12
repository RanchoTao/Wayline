import { chromium } from "playwright-core";

const EXE = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(String(err)));
let failures = 0;
const check = (cond, label) => { console.log(`${cond ? "PASS" : "FAIL"} ${label}`); if (!cond) failures++; };

// fresh demo session
await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(800);

// Top1 should be demo-task-3 (in_progress in demo seed) => shows 标记完成 only
const top1 = page.locator('[data-testid="top-task-1"]');
const top1Id = await top1.getAttribute("data-task-id");
check(top1Id === "demo-task-3", `Top1 is demo-task-3 (got ${top1Id})`);
const top1StartBtn = top1.getByRole("button", { name: "开始任务" });
const top1CompleteBtn = top1.getByRole("button", { name: "标记完成" });
check((await top1StartBtn.count()) === 0, "in_progress task shows no 开始任务");
check(await top1CompleteBtn.isVisible(), "in_progress task shows 标记完成");

// Top2 = demo-task-4 (in_progress) same; Top3 = demo-task-9 (ready) => should show 开始任务
const top3 = page.locator('[data-testid="top-task-3"]');
const top3Id = await top3.getAttribute("data-task-id");
check(top3Id === "demo-task-9", `Top3 is demo-task-9 ready task (got ${top3Id})`);
check(await top3.getByRole("button", { name: "开始任务" }).isVisible(), "ready task shows 开始任务");

// click 开始任务 on Top3
await top3.getByRole("button", { name: "开始任务" }).click();
await page.waitForTimeout(400);
const top3After = page.locator('[data-testid="top-task-3"]');
const statusAfter = await top3After.locator("text=进行中").count();
check(statusAfter === 1, "开始任务 flips status badge to 进行中");
const startBtnGone = await top3After.getByRole("button", { name: "开始任务" }).count();
check(startBtnGone === 0, "开始任务 button disappears after start");
check(await top3After.getByRole("button", { name: "标记完成" }).isVisible(), "标记完成 appears after start");

// now complete Top1 => Top3 refills
const beforeTitles = await page.locator('[data-testid^="top-task-"]').allTextContents();
await top1.getByRole("button", { name: "标记完成" }).click();
await page.waitForTimeout(500);
const afterTitles = await page.locator('[data-testid^="top-task-"]').allTextContents();
check(JSON.stringify(beforeTitles) !== JSON.stringify(afterTitles), "Top 3 refills after completion");

// persistence: reload keeps demo-task-9 as in_progress
await page.reload();
await page.waitForTimeout(700);
const persisted = await page.evaluate(() => {
  const raw = localStorage.getItem("wayline-core-v2");
  if (!raw) return null;
  const state = JSON.parse(raw).state;
  return { tasks: state.tasks.length, task9: state.tasks.find((t) => t.id === "demo-task-9")?.status };
});
check(persisted?.task9 === "in_progress", `started task persists as in_progress (got ${persisted?.task9})`);
check(persisted && persisted.tasks >= 10, `tasks persisted (${persisted?.tasks})`);

// plan page list reflects status label
await page.getByRole("button", { name: "计划", exact: true }).click();
await page.waitForTimeout(400);
const row = page.locator('[data-testid="task-list"] [data-task-id="demo-task-9"]');
check(await row.count() === 1, "plan list shows demo-task-9");
check((await row.textContent()).includes("进行中"), "plan list shows 进行中 for started task");

// blocked high-priority task (demo-task-8) must NOT show actionable start/complete buttons
// open its editor via heat zone? simpler: verify engine-level exclusion is already covered by tests.
// Here verify plan list still renders it with 待开始 + blocked reason.
const blockedRow = page.locator('[data-testid="task-list"] [data-task-id="demo-task-8"]');
check(await blockedRow.count() === 1, "blocked demo-task-8 visible in plan list");
check((await blockedRow.textContent()).includes("需先完成前置任务"), "blocked task shows prerequisite hint in plan list");

check(errors.length === 0, `no console errors${errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""}`);

await browser.close();
if (failures) process.exitCode = 1;
else console.log("\nALL START-TASK WALKTHROUGH CHECKS PASSED");
