import { chromium } from "playwright-core";

const EXE = process.env.CHROME_PATH || (process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : undefined);
const BASE = process.env.BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ executablePath: EXE, headless: true });
let failures = 0;
const check = (condition, label) => { console.log(`${condition ? "PASS" : "FAIL"}  ${label}`); if (!condition) failures += 1; };

try {
  for (const width of [375, 820, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "先走最值得走的一步。" }).waitFor();
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    check(dimensions.scrollWidth <= dimensions.width + 1, `no horizontal overflow at ${width}px`);
    check(await page.getByRole("navigation", { name: "主导航" }).getByRole("button").count() === 3, `only three main pages at ${width}px`);
    check(await page.getByRole("button", { name: "＋ 记录", exact: true }).isVisible(), `capture stays visible at ${width}px`);
    await page.close();
  }
} finally {
  await browser.close();
}

if (failures) process.exitCode = 1;
else console.log("ALL WAYLINE LAYOUT CHECKS PASSED");
