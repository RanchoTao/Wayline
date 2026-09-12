// P4 intentionally injects a failure only into this app request. It never
// reads, writes, backs up, or changes any PilotDeck global configuration.
import { chromium } from "playwright-core";

const EXE = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE_URL || "http://localhost:3000";
const results = [];
const check = (ok, name, extra = "") => results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? ` (${extra})` : ""}`);

const browser = await chromium.launch({ executablePath: EXE, headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${BASE}/?debug=1&forcePilotDeckFailure=1`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "＋ 记录", exact: true }).click();
  await page.locator('textarea[aria-label="记录内容"]').fill("准备新加坡旅行，需要订机票、订酒店、办签证。");
  await page.getByRole("button", { name: "理解并预览" }).click();
  await page.waitForSelector("text=确认加入", { timeout: 30_000 });
  await page.waitForFunction(() => document.querySelector('[data-testid="pilotdeck-debug"]')?.textContent?.includes("fallback: true"), undefined, { timeout: 5_000 });
  check((await page.locator("body").innerText()).includes("新加坡"), "fallback returns a usable result");
  const panel = await page.locator('[data-testid="pilotdeck-debug"]').innerText();
  check(/MOCK/.test(panel), "debug shows MOCK provider");
  check(/fallback:\s*true/.test(panel), "debug shows fallback:true");
  check(/forced project-local/.test(panel), "debug shows project-local failure reason");
  check((await page.getByRole("status").innerText()).includes("本地理解"), "UI shows recoverable fallback notice");
  await page.getByRole("button", { name: "确认加入" }).click();
  await page.getByRole("button", { name: "计划", exact: true }).click();
  check((await page.locator("body").innerText()).includes("新加坡"), "fallback result enters task store");
  check(errors.length === 0, "no page errors", errors.join(" | "));
} finally {
  await browser.close();
}

console.log(results.join("\n"));
process.exit(results.some((result) => result.startsWith("FAIL")) ? 1 : 0);
