/**
 * End-to-end smoke test for the VisualDeadline Agent workspace.
 * Run: node scripts/smoke.mjs   (requires dev server on :3000)
 */
import { chromium } from "playwright-core";

const EXE = process.env.CHROME_PATH || (process.platform === "darwin"
  ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  : undefined);
const BASE = process.env.BASE_URL || "http://localhost:3000";


let failures = 0;
function check(cond, label) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures++;
}

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push(String(err)));

// ---- 1. open workspace ----
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector('h1:has-text("WAYLINE")', { timeout: 30000 });
console.log("opened workspace");
check(await page.isVisible("text=让目标，步步可达。"), "empty state visible on first load");

await page.screenshot({ path: "scripts/shots/01-empty.png" });

// ---- 2. load hackathon demo ----
await page.locator("button:has-text('加载示例计划')").first().click();
await page.waitForSelector("text=截止时间", { timeout: 15000 });
await page.waitForTimeout(1200);

const bodyText = () => page.evaluate(() => document.body.innerText);

let t = await bodyText();
check(t.includes("时间消耗"), "时间消耗 strip visible");
check(t.includes("任务完成"), "任务完成 strip visible");
check(t.includes("进度偏差"), "进度偏差 strip visible");
check(/65%/.test(t), "时间消耗 = 65%");
check(/42%/.test(t), "任务完成 = 42%");
check(t.includes("落后"), "落后 SCHEDULE shown");
check(t.includes("PilotDeck 接入"), "bottleneck = PilotDeck Integration");
check(/0\.6\d 高风险/.test(t), "risk reads 高风险 (0.6x)");
check(t.includes("进度落后"), "STATUS: behind schedule");
check(t.includes("计划洞察"), "insight panel present");
check(t.includes("本地规划助手"), "本地规划助手 badge shown");

await page.screenshot({ path: "scripts/shots/02-demo.png" });

// ---- 3. send constraint ----
await page.fill("textarea", "今天只有 3 小时");
await page.waitForSelector("button:has-text('调整计划')", { timeout: 8000 });
await page.click("button:has-text('调整计划')");
await page.waitForSelector("button:has-text('应用新计划')", { timeout: 15000 });
t = await bodyText();
check(t.includes("调整方案已就绪"), "调整方案已就绪 banner shown");
check(/已识别限制/i.test(t), "agent explained the constraint");
await page.screenshot({ path: "scripts/shots/03-replan-ready.png" });

// ---- 4. apply plan ----
await page.click("button:has-text('应用新计划')");
await page.waitForTimeout(1200);
t = await bodyText();
check(t.includes("新计划已应用"), "conversation logs 新计划已应用");
check(t.includes("已延期"), "a task deferred (Visual Polish)");
check(t.includes("已取消"), "a task cancelled (Landing Page)");
check(/0\.5\d 中风险/.test(t), "risk dropped to 中风险 after replan");
await page.screenshot({ path: "scripts/shots/04-after-apply.png" });

// ---- 5. persistence across reload ----
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector('h1:has-text("WAYLINE")', { timeout: 30000 });
await page.waitForTimeout(800);
t = await bodyText();
check(/PilotDeck 接入/i.test(t), "project persisted after reload (tasks present)");
check(t.includes("已延期"), "replan persisted after reload (Visual Polish deferred)");
check(t.includes("计划洞察"), "insight persisted after reload");

// ---- 6. task progress edit ----
await page.click("text=界面原型");
await page.waitForSelector("button:has-text('100%')", { timeout: 8000 });
const storedTitleBefore = await page.evaluate(() => JSON.parse(localStorage.getItem("vd-workspace-v1"))?.state?.project?.tasks.find((t) => t.id === "t_ui_prototype")?.title);
check(storedTitleBefore === "UI Prototype", "localized task label preserves internal title");
await page.click("button:has-text('100%')");
await page.waitForTimeout(400);
await page.keyboard.press("Escape");
await page.click("button:has-text('关闭')").catch(() => {});
await page.waitForTimeout(300);
const savedTask = await page.evaluate(() => JSON.parse(localStorage.getItem("vd-workspace-v1"))?.state?.project?.tasks.find((t) => t.id === "t_ui_prototype"));
check(savedTask?.progress === 1 && savedTask?.title === "UI Prototype", "progress saved without changing the original task title");
await page.screenshot({ path: "scripts/shots/05-task-done.png" });

await browser.close();

console.log("\nconsole errors:", consoleErrors.length ? consoleErrors : "none");
console.log(failures === 0 ? "\nALL SMOKE CHECKS PASSED" : `\n${failures} CHECKS FAILED`);
process.exit(failures === 0 ? 0 : 1);
