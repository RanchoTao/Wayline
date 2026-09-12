// TEST P1 (real browser): text capture must go through the real PilotDeck
// bridge and the ?debug=1 panel must show provider=PILOTDECK.
import { chromium } from "playwright-core";
const EXE = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE_URL || "http://localhost:3000";

const results = [];
const check = (ok, name, extra = "") => { results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? ` (${extra})` : ""}`); };

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto(`${BASE}/?debug=1`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForSelector('[data-testid="pilotdeck-debug"]', { timeout: 20000 });

// open capture modal
await page.getByRole("button", { name: "＋ 记录", exact: true }).click();
await page.waitForSelector("input[type=file], textarea, [contenteditable=true]", { timeout: 10000 });

// find the text input (textarea or contenteditable)
const textInput = page.locator('textarea[aria-label="记录内容"]');
await textInput.fill("两周后机器学习考试，需要复习1-8章、完成练习题并做一次模拟测试。");
await page.getByRole("button", { name: "理解并预览" }).click();

// wait for analysis to finish (result preview shows)
await page.waitForTimeout(12000);
const bodyText = await page.locator("body").innerText();
check(bodyText.includes("机器学习"), "capture result appears");

// confirm into task store
const confirmBtn = page.getByRole("button", { name: "确认加入" }).first();
if (await confirmBtn.count()) {
  await confirmBtn.click();
  await page.waitForTimeout(2000);
}
// The Today view only lists task titles (subtasks like 复习第1-2章…), so the
// project title shows on the Plan view. Navigate there like the P4 test does.
await page.getByRole("button", { name: "计划", exact: true }).click();
await page.waitForTimeout(1500);
const afterText = await page.locator("body").innerText();
check(afterText.includes("机器学习"), "task store contains ML exam project");

// debug panel contents
const panel = page.locator('[data-testid="pilotdeck-debug"]');
const panelText = await panel.innerText();
check(panelText.includes("provider:"), "debug panel shows provider row");
check(/PILOTDECK|MOCK/.test(panelText), "debug panel provider value set", panelText.split("\n").find((l) => l.includes("provider:"))?.trim() ?? "");
check(/model:/i.test(panelText), "debug panel shows model row");
check(/latency/i.test(panelText), "debug panel shows latency row");
check(/request:/i.test(panelText), "debug panel shows request type");

check(errors.length === 0, "no page errors", errors.join(" | ").slice(0, 200));

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
await browser.close();
process.exit(failed ? 1 : 0);
