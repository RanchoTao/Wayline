// TEST P3 (real browser): voice tab — transcript from browser ASR enters the
// SAME PilotDeck understand pipeline (voice is not a separate system).
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
await page.getByRole("button", { name: "＋ 记录", exact: true }).click();

// voice tab renders a mic button; the transcript (real ASR output in a live
// demo) lands in the same 记录内容 textarea. Simulate the transcript here.
await page.getByRole("tab", { name: "语音" }).click();
const transcript = "明天下午之前把概率论作业第三章完成";
await page.locator('textarea[aria-label="记录内容"]').fill(transcript);
await page.getByRole("button", { name: "理解并预览" }).click();
await page.waitForSelector("text=确认加入", { timeout: 90000 });

const bodyText = await page.locator("body").innerText();
check(bodyText.includes("概率论"), "voice transcript understood as executable task");

await page.getByRole("button", { name: "确认加入" }).click();
await page.waitForTimeout(3000);
await page.getByRole("button", { name: "计划", exact: true }).click();
await page.waitForTimeout(1500);
const planText = await page.locator("body").innerText();
check(planText.includes("概率论"), "voice task entered unified task store");

const panel = await page.locator('[data-testid="pilotdeck-debug"]').innerText();
check(/PILOTDECK/.test(panel), "voice went through PilotDeck provider");
check(errors.length === 0, "no page errors", errors.join(" | ").slice(0, 200));

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
await browser.close();
process.exit(failed ? 1 : 0);
