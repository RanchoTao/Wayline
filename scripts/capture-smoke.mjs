import { chromium } from "playwright-core";
import path from "node:path";

const EXE = process.env.CHROME_PATH || (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : undefined);
const BASE = process.env.BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ executablePath: EXE, headless: true });
let failures = 0;
const check = (condition, label) => { console.log(`${condition ? "PASS" : "FAIL"}  ${label}`); if (!condition) failures += 1; };

try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.goto(`${BASE}/?mock=1`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "先走最值得走的一步。" }).waitFor();
  await page.getByRole("button", { name: "＋ 记录", exact: true }).click();
  await page.getByRole("tab", { name: "图片" }).click();
  await page.locator('input[type="file"]').setInputFiles(path.resolve("scripts/shots/wayline-today.png"));
  await page.getByLabel("记录内容").fill("机器学习课程两周后考试，考试范围 1-8 章。");
  await page.getByRole("button", { name: "理解并预览" }).click();
  const imagePreview = page.getByTestId("capture-preview");
  await imagePreview.waitFor();
  check((await imagePreview.innerText()).includes("媒体已进入 pipeline"), "image bytes and metadata enter capture provider");
  check(await imagePreview.locator("ol > li").count() === 8, "image context reaches task understanding and decomposition");
  await page.getByRole("button", { name: "取消" }).click();

  await page.getByRole("button", { name: "＋ 记录", exact: true }).click();
  await page.getByRole("tab", { name: "语音" }).click();
  await page.getByLabel("记录内容").fill("完成机器学习第三章习题 1-10");
  await page.getByRole("button", { name: "理解并预览" }).click();
  const voicePreview = page.getByTestId("capture-preview");
  await voicePreview.waitFor();
  check((await voicePreview.innerText()).includes("可执行任务"), "voice transcript enters the same understanding pipeline");
  check(await voicePreview.locator("ol > li").count() === 1, "voice executable task is not over-decomposed");
  await page.getByRole("button", { name: "取消" }).click();
} finally {
  await browser.close();
}

if (failures) process.exitCode = 1;
else console.log("ALL MULTIMODAL CAPTURE CHECKS PASSED");
