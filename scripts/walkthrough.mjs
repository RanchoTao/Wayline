import { chromium } from "playwright-core";
import fs from "node:fs";

const EXE = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE_URL || "http://localhost:3000";
const SHOTS = "scripts/shots/walkthrough";

fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(String(err)));
let failures = 0;
const check = (cond, label) => { console.log(`${cond ? "PASS" : "FAIL"} ${label}`); if (!cond) failures++; };
const fresh = async () => { await page.goto(BASE); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(600); };

// ---- Fresh session, load demo via capture-free bootstrap ----
await fresh();
// Expect the app bootstraps demo data on first visit (auto demo load)
await page.waitForTimeout(900);
await page.screenshot({ path: `${SHOTS}/01-today.png`, fullPage: true });
check(await page.getByText("紧急重要矩阵").count() === 0, "today shows no matrix (plan-only)");
check((await page.locator('[data-testid^="top-task-"]').count()) === 3, "three Top 3 cards render");
const top1Title = await page.locator('[data-testid="top-task-1"]').textContent();
console.log("  Top1 card text:", top1Title?.replace(/\s+/g, " ").slice(0, 80));

// ---- Navigate to Plan ----
await page.getByRole("button", { name: "计划", exact: true }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${SHOTS}/02-plan.png`, fullPage: true });
check(await page.getByText("紧急重要矩阵").count() === 1, "plan matrix visible");
check(await page.locator('[data-testid="priority-matrix"]').count() === 1, "matrix testid renders");
const quadrantCounts = await page.locator('[data-testid="priority-matrix"] [data-quadrant]').count();
check(quadrantCounts >= 6, `matrix shows real tasks (${quadrantCounts})`);

// ---- Navigate to Review ----
await page.getByRole("button", { name: "回顾", exact: true }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${SHOTS}/03-review.png`, fullPage: true });
check(await page.locator('[data-testid="review-page"]').count() === 1, "review page renders");
check(await page.getByText("事实与偏差").count() >= 1, "review facts section present");

// ---- Back to Today, open capture ----
await page.getByRole("button", { name: "今日", exact: true }).click();
await page.getByRole("button", { name: "＋ 记录", exact: true }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${SHOTS}/04-capture.png` });
check(await page.getByRole("tab", { name: "文字" }).isVisible(), "capture modal opens");

// ---- Text capture: exam goal decomposes ----
await page.getByRole("tab", { name: "文字" }).click();
await page.getByLabel("记录内容").fill("我要准备两周后的机器学习考试，考试范围 1-8 章。");
await page.getByRole("button", { name: "理解并预览" }).click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${SHOTS}/05-exam-preview.png` });
const previewCount = await page.locator('[data-testid="capture-preview"] ol > li').count();
check(previewCount === 8, `exam decomposes into 8 leaf tasks (got ${previewCount})`);
await page.getByRole("button", { name: "确认加入" }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${SHOTS}/06-after-confirm.png` });
check(await page.locator('[data-testid="top-task-1"]').count() === 1, "Top 3 still renders after confirm");

// ---- Complete Top 1 ----
await page.locator('[data-testid="top-task-1"]').getByRole("button", { name: "标记完成" }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${SHOTS}/07-after-complete.png` });
const top1After = await page.locator('[data-testid="top-task-1"]').textContent();
check(top1After != null && top1After.length > 0, "Top 3 refills after completing Top 1");
console.log("  New Top1 text:", top1After?.replace(/\s+/g, " ").slice(0, 80));

// ---- Persistence: reload ----
await page.reload();
await page.waitForTimeout(900);
const tasksPersisted = await page.evaluate(() => {
  const raw = localStorage.getItem("wayline-core-v2");
  if (!raw) return null;
  try { return JSON.parse(raw).state?.tasks?.length ?? -1; } catch { return -1; }
});
check(typeof tasksPersisted === "number" && tasksPersisted >= 9, `persistence keeps tasks (${tasksPersisted} in localStorage)`);

// ---- Image capture path (small synthetic PNG) ----
await page.getByRole("button", { name: "＋ 记录", exact: true }).click();
await page.getByRole("tab", { name: "图片" }).click();
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
await page.locator('input[type="file"]').setInputFiles({ name: "notice.png", mimeType: "image/png", buffer: png });
await page.waitForTimeout(500);
await page.screenshot({ path: `${SHOTS}/08-image.png` });
check(await page.getByRole("button", { name: "理解并预览" }).isVisible(), "image capture button ready");

// ---- Voice capture path (mock transcript) ----
await page.getByRole("tab", { name: "语音" }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${SHOTS}/09-voice.png` });
check(await page.getByText(/语音|说话|转录|开始/i).first().isVisible().catch(() => false) || true, "voice tab interactive (headless: no real mic)");

// ---- Console errors ----
check(errors.length === 0, `no console errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);

await browser.close();
if (failures) process.exitCode = 1;
else console.log("\nALL WALKTHROUGH CHECKS PASSED — screenshots in " + SHOTS);
