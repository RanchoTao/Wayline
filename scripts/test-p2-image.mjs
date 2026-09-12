// TEST P2 (real browser): upload a real course-notice screenshot;
// the multimodal path must go through the real PilotDeck bridge (minimax-m3).
import { chromium } from "playwright-core";
import { resolve } from "node:path";
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

// switch to image tab first; the file input renders only in image mode
await page.getByRole("tab", { name: "图片" }).click();
await page.waitForSelector('input[type="file"]', { timeout: 10000 });
await page.locator('input[type="file"]').setInputFiles(resolve("scripts/shots/course-notice.png"));
await page.getByRole("button", { name: "理解并预览" }).click();
await page.waitForSelector("text=确认加入", { timeout: 90000 });

const bodyText = await page.locator("body").innerText();
check(bodyText.includes("期中考试") || bodyText.includes("机器学习"), "image understood as exam project");
check(bodyText.includes("9/26") || bodyText.includes("9月26日") || bodyText.includes("2026/9/26"), "deadline extracted from image");

await page.getByRole("button", { name: "确认加入" }).click();
await page.waitForTimeout(3000);
await page.getByRole("button", { name: "计划", exact: true }).click();
await page.waitForTimeout(1500);
const planText = await page.locator("body").innerText();
// leaf tasks decomposed from the image enter the unified task pool
check(planText.includes("回复李老师") || planText.includes("模拟测试"), "task store contains decomposed tasks from image");
const ls = await page.evaluate(() => { const raw = localStorage.getItem("wayline-core-v2"); if (!raw) return -1; return JSON.parse(raw).state.tasks.length; });
check(ls > 10, "task pool grew after confirm", `tasks=${ls}`);

const panel = page.locator('[data-testid="pilotdeck-debug"]');
const panelText = await panel.innerText();
check(/PILOTDECK/.test(panelText), "debug panel provider PILOTDECK");
check(/multimodal/.test(panelText), "debug panel requestType multimodal");
check(/minimax/.test(panelText), "debug panel model minimax");
check(/latency/.test(panelText), "debug panel latency shown");
check(errors.length === 0, "no page errors", errors.join(" | ").slice(0, 200));

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
await browser.close();
process.exit(failed ? 1 : 0);
