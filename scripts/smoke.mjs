import { chromium } from "playwright-core";

const EXE = process.env.CHROME_PATH || (process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : undefined);
const BASE = process.env.BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ executablePath: EXE, headless: true });
let failures = 0;
const check = (condition, label) => { console.log(`${condition ? "PASS" : "FAIL"}  ${label}`); if (!condition) failures += 1; };

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "先走最值得走的一步。" }).waitFor();

  const capture = async (text, confirm = true) => {
    await page.getByRole("button", { name: "＋ 记录", exact: true }).click();
    await page.getByRole("tab", { name: "文字" }).click();
    await page.getByLabel("记录内容").fill(text);
    await page.getByRole("button", { name: "理解并预览" }).click();
    await page.getByTestId("capture-preview").waitFor();
    if (confirm) await page.getByRole("button", { name: "确认加入" }).click();
  };

  await capture("完成概率论习题 1-10，明天截止，重要性 10");
  const topOne = page.getByTestId("top-task-1");
  check((await topOne.innerText()).includes("完成概率论习题 1-10"), "A urgent importance-10 task becomes Top 1");
  await page.getByRole("button", { name: "计划", exact: true }).click();
  const urgentPoint = page.getByTestId("priority-matrix").locator("button").filter({ hasText: "完成概率论习题 1-10" });
  check(await urgentPoint.getAttribute("data-quadrant") === "I", "A urgent importance-10 task is in quadrant I");

  await capture("完成个人系统清单 1-10，半年后截止，重要性 2");
  await page.getByRole("button", { name: "今日", exact: true }).click();
  check(!(await page.locator('[data-testid^="top-task-"]').allInnerTexts()).join(" ").includes("个人系统清单"), "B long-horizon importance-2 task stays out of Top 3");

  await page.getByRole("button", { name: "计划", exact: true }).click();
  const longPoint = page.getByTestId("priority-matrix").locator("button").filter({ hasText: "完成个人系统清单 1-10" });
  const scoreBefore = Number(await longPoint.getAttribute("data-priority"));
  await longPoint.click();
  const tomorrow = new Date(Date.now() + 86_400_000);
  const local = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  await page.getByLabel("任务截止时间").fill(local);
  await page.getByRole("button", { name: "保存并同步" }).click();
  const scoreAfter = Number(await page.getByTestId("priority-matrix").locator("button").filter({ hasText: "完成个人系统清单 1-10" }).getAttribute("data-priority"));
  check(scoreAfter > scoreBefore, "C deadline edit updates matrix priority immediately");
  await page.getByRole("button", { name: "今日", exact: true }).click();
  check(await page.getByTestId("heat-zone").locator("button").filter({ hasText: "完成个人系统清单 1-10" }).count() === 1, "C deadline edit updates Heat Zone");

  const firstId = await page.getByTestId("top-task-1").getAttribute("data-task-id");
  await page.getByTestId("top-task-1").getByRole("button", { name: "标记完成" }).click();
  check(await page.getByTestId("top-task-1").getAttribute("data-task-id") !== firstId, "D completing Top 1 promotes the next task");
  check(await page.locator('[data-testid^="top-task-"]').count() === 3, "D Top 3 automatically refills");

  await capture("我要准备两周后的机器学习考试，考试范围 1-8 章。", false);
  const preview = page.getByTestId("capture-preview");
  check((await preview.innerText()).includes("目标 / Project"), "E exam preparation is recognized as a project");
  check(await preview.locator("ol > li").count() === 8, "E exam project decomposes into eight tasks");
  await page.getByRole("button", { name: "确认加入" }).click();

  await capture("今天晚上把第三章习题 1-10 做完。", false);
  check((await page.getByTestId("capture-preview").innerText()).includes("可执行任务"), "F scoped exercise is actionable");
  check(await page.getByTestId("capture-preview").locator("ol > li").count() === 1, "F scoped exercise is not over-decomposed");
  await page.getByRole("button", { name: "取消" }).click();

  const storedBefore = await page.evaluate(() => JSON.parse(localStorage.getItem("wayline-core-v2"))?.state?.tasks?.length);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "先走最值得走的一步。" }).waitFor();
  const storedAfter = await page.evaluate(() => JSON.parse(localStorage.getItem("wayline-core-v2"))?.state?.tasks?.length);
  check(storedBefore === storedAfter && storedAfter > 8, "G tasks persist across refresh");

  await page.getByRole("button", { name: "回顾", exact: true }).click();
  const reviewText = await page.getByTestId("review-page").innerText();
  check(/完成任务\s+3/.test(reviewText), "H review uses real completed task timestamps");
  check(reviewText.includes("事实与偏差"), "H review exposes facts and deviations");
  check(errors.length === 0, `no browser console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} finally {
  await browser.close();
}

if (failures) process.exitCode = 1;
else console.log("ALL WAYLINE CORE LOOP CHECKS PASSED");
