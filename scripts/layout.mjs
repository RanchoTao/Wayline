/**
 * Visual-structure + fresh-goal-flow checks (DOM-level, no screenshots needed).
 * Run: node scripts/layout.mjs   (dev server on :3000)
 */
import { chromium } from "playwright-core";

const EXE = process.env.CHROME_PATH || (process.platform === "darwin"
  ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  : undefined);
const BASE = process.env.BASE_URL || "http://localhost:3000";


let failures = 0;
const check = (c, l) => {
  console.log(`${c ? "PASS" : "FAIL"}  ${l}`);
  if (!c) failures++;
};

const browser = await chromium.launch({ executablePath: EXE, headless: true });

// ---------- desktop: geometry & styling ----------
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.locator("button:has-text('加载示例计划')").first().click();
  await page.waitForSelector("text=截止时间", { timeout: 15000 });
  await page.waitForTimeout(600);

  const geo = await page.evaluate(() => {
    const rect = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, w: r.width };
    };
    const agent = rect("aside:nth-of-type(1)");
    const center = rect("section:nth-of-type(1)");
    const insight = rect("aside:nth-of-type(2)");
    const vw = document.documentElement.clientWidth;
    return { agent, center, insight, vw };
  });
  const vw = geo.vw;
  check(Math.abs(geo.agent.w / vw - 0.25) < 0.02, `Agent panel ≈ 25% wide (${(geo.agent.w / vw * 100).toFixed(1)}%)`);
  check(Math.abs(geo.center.w / vw - 0.5) < 0.03, `Timeline ≈ 50% wide (${(geo.center.w / vw * 100).toFixed(1)}%)`);
  check(Math.abs(geo.insight.w / vw - 0.25) < 0.02, `Insight ≈ 25% wide (${(geo.insight.w / vw * 100).toFixed(1)}%)`);

  const style = await page.evaluate(() => {
    const countdown = [...document.querySelectorAll("span")].find((s) => /\d{2}天 \d{2}时 \d{2}分/.test(s.textContent || ""));
    const bodyBg = getComputedStyle(document.body).backgroundColor;
    // the deadline chip is the vd-pulse element whose text starts with the chip
    const chips = [...document.querySelectorAll("div,span")].filter((s) =>
      (s.textContent || "").trim().startsWith("截止时间") &&
      getComputedStyle(s).animationName === "vd-pulse"
    );
    const deadline = chips[0];
    const main = document.querySelector("main");
    return {
      countdownText: countdown?.textContent?.trim() ?? null,
      countdownColor: countdown ? getComputedStyle(countdown).color : null,
      bodyBg,
      deadlineColor: deadline ? getComputedStyle(deadline).color : null,
      mainScrolls: main ? main.scrollHeight > main.clientHeight || getComputedStyle(main).overflowY === "auto" : false,
      hasHorizOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
  check(/^\d{2}天 \d{2}时 \d{2}分$/.test(style.countdownText ?? ""), `countdown format OK (${style.countdownText})`);
  check(style.countdownColor === "rgb(36, 89, 118)", `countdown is lake blue (${style.countdownColor})`);
  check(style.bodyBg === "rgb(245, 249, 251)", `paper background (${style.bodyBg})`);
  check(!style.hasHorizOverflow, "no horizontal overflow on desktop");
  check(style.deadlineColor === "rgb(151, 75, 54)", `deadline chip retains warm risk color (${style.deadlineColor})`);
  await page.close();
}

// ---------- mobile: stacks, scrolls, no horizontal overflow ----------
{
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.locator("button:has-text('加载示例计划')").first().click();
  await page.waitForSelector("text=截止时间", { timeout: 15000 });
  await page.waitForTimeout(500);
  const mob = await page.evaluate(() => {
    const main = document.querySelector("main");
    return {
      vw: document.documentElement.clientWidth,
      sw: document.documentElement.scrollWidth,
      mainScrolls: main ? main.scrollHeight > main.clientHeight : false,
    };
  });
  check(mob.sw <= mob.vw + 1, `no horizontal overflow on mobile (scrollW ${mob.sw} <= viewport ${mob.vw})`);
  check(mob.mainScrolls, "timeline area scrolls vertically on mobile");
  const agentW = await page.evaluate(() => document.querySelector("aside").getBoundingClientRect().width);
  check(Math.abs(agentW - (mob.vw - 24)) < 2, `panels stack within mobile gutters (${agentW}px)`);
  await page.close();
}

// ---------- tablet: wrapped header remains fully visible ----------
for (const width of [820, 1024]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.locator("button:has-text('加载示例计划')").first().click();
  await page.waitForSelector("text=界面原型");
  const headerFits = await page.evaluate(() => {
    const header = document.querySelector("header");
    const bounds = header.getBoundingClientRect();
    return [...header.querySelectorAll("h1, button, span")].every((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width === 0 || (rect.top >= bounds.top && rect.bottom <= bounds.bottom && rect.right <= innerWidth);
    });
  });
  check(headerFits, `header controls stay visible at ${width}px`);
  await page.screenshot({ path: `scripts/shots/wayline-demo-${width}.png` });
  await page.close();
}

// ---------- fresh goal → 生成计划 (Chinese input, no demo) ----------
{
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 900 },
  });
  await ctx.addInitScript(() => localStorage.clear());
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=让目标，步步可达。", { timeout: 15000 });

  await page.fill(
    "textarea",
    "9 月 20 日之前完成黑客松作品，我现在只有一个想法，需要完成产品设计、前端、PilotDeck Agent、测试、Demo 和答辩 PPT。"
  );
  await page.click("button:has-text('生成计划')");
  await page.waitForSelector("text=截止时间", { timeout: 20000 });
  await page.waitForTimeout(800);

  const t = await page.evaluate(() => document.body.innerText);
  check(t.includes("9月20日"), `deadline parsed to 9月20日 from Chinese text (${/9月20日/.test(t)})`);
  const rows = await page.evaluate(
    () => document.querySelectorAll("section [class*='flex flex-col gap-1'] > div").length
  );
  check(rows >= 8, `fresh plan has 8+ task rows (${rows})`);
  check(/1\.1D/.test(t) || t.includes("计划洞察"), "workspace renders after 生成计划");
  check(!t.includes("让目标，步步可达。"), "empty state replaced by plan");
  await page.screenshot({ path: "scripts/shots/06-fresh-plan.png" });
  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? "\nALL LAYOUT CHECKS PASSED" : `\n${failures} CHECKS FAILED`);
process.exit(failures === 0 ? 0 : 1);
