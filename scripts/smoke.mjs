/**
 * End-to-end smoke test for the VisualDeadline Agent workspace.
 * Run: node scripts/smoke.mjs   (requires dev server on :3000)
 */
import { chromium } from "playwright-core";

const EXE =
  "C:\\Users\\RanchoTao\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe";
const BASE = "http://localhost:3000";

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
await page.waitForSelector("text=VISUALDEADLINE", { timeout: 30000 });
console.log("opened workspace");
check(await page.isVisible("text=MAKE TIME VISIBLE."), "empty state visible on first load");

await page.screenshot({ path: "scripts/shots/01-empty.png" });

// ---- 2. load hackathon demo ----
await page.click("button:has-text('LOAD HACKATHON DEMO')");
await page.waitForSelector("text=DEADLINE", { timeout: 15000 });
await page.waitForTimeout(1200);

const bodyText = () => page.evaluate(() => document.body.innerText);

let t = await bodyText();
check(t.includes("TIME USED"), "TIME USED strip visible");
check(t.includes("WORK DONE"), "WORK DONE strip visible");
check(t.includes("SCHEDULE GAP"), "SCHEDULE GAP strip visible");
check(/65%/.test(t), "TIME USED = 65%");
check(/42%/.test(t), "WORK DONE = 42%");
check(t.includes("BEHIND"), "BEHIND SCHEDULE shown");
check(t.includes("PILOTDECK INTEGRATION"), "bottleneck = PilotDeck Integration");
check(/0\.6\d HIGH/.test(t), "risk reads HIGH (0.6x)");
check(t.includes("Behind schedule"), "STATUS: behind schedule");
check(t.includes("AGENT INSIGHT"), "insight panel present");
check(t.includes("MOCK AGENT"), "MOCK AGENT badge shown");

await page.screenshot({ path: "scripts/shots/02-demo.png" });

// ---- 3. send constraint ----
await page.fill("textarea", "I only have 3 hours today");
await page.waitForSelector("button:has-text('REPLAN')", { timeout: 8000 });
await page.click("button:has-text('REPLAN')");
await page.waitForSelector("button:has-text('APPLY PLAN')", { timeout: 15000 });
t = await bodyText();
check(t.includes("REPLAN READY"), "REPLAN READY banner shown");
check(/Constraint detected/i.test(t), "agent explained the constraint");
await page.screenshot({ path: "scripts/shots/03-replan-ready.png" });

// ---- 4. apply plan ----
await page.click("button:has-text('APPLY PLAN')");
await page.waitForTimeout(1200);
t = await bodyText();
check(t.includes("PLAN APPLIED"), "conversation logs PLAN APPLIED");
check(t.includes("DEFERRED"), "a task deferred (Visual Polish)");
check(t.includes("CANCELLED"), "a task cancelled (Landing Page)");
check(/0\.5\d MEDIUM/.test(t), "risk dropped to MEDIUM after replan");
await page.screenshot({ path: "scripts/shots/04-after-apply.png" });

// ---- 5. persistence across reload ----
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("text=VISUALDEADLINE", { timeout: 30000 });
await page.waitForTimeout(800);
t = await bodyText();
check(/pilotdeck integration/i.test(t), "project persisted after reload (tasks present)");
check(t.includes("DEFERRED"), "replan persisted after reload (Visual Polish deferred)");
check(t.includes("AGENT INSIGHT"), "insight persisted after reload");

// ---- 6. task progress edit ----
await page.click("text=UI Prototype");
await page.waitForSelector("button:has-text('100%')", { timeout: 8000 });
await page.click("button:has-text('100%')");
await page.waitForTimeout(400);
await page.keyboard.press("Escape");
await page.click("button:has-text('CLOSE')").catch(() => {});
await page.waitForTimeout(300);
await page.screenshot({ path: "scripts/shots/05-task-done.png" });

await browser.close();

console.log("\nconsole errors:", consoleErrors.length ? consoleErrors : "none");
console.log(failures === 0 ? "\nALL SMOKE CHECKS PASSED" : `\n${failures} CHECKS FAILED`);
process.exit(failures === 0 ? 0 : 1);
