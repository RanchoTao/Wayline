# wayline
hiYouth hackathon project-20260912
> **wayline turns vague goals into visible, adaptive execution plans.**
> 把「我要做完这件事」变成一条真正可以执行、可以动态调整的时间线。

An Agent-native, local-first deadline cockpit built for the **Hi Youth Hackathon (PilotDeck track)**.
No login, no backend, no cloud — open the page and the workspace is already there.

## What it does

- Parses a plain-language goal + deadline (Chinese or English) into a structured project
- Builds a task timeline with dependencies, priorities, and a critical path
- Externalizes time cognition: **TIME LEFT** (calendar) vs **EFFECTIVE TIME** (working hours), **TIME USED** vs **WORK DONE**, and **SCHEDULE GAP**
- Runs a deterministic risk engine (LOW / MEDIUM / HIGH / CRITICAL)
- Listens for constraints ("I only have 3 hours today") and **replans**: CANCEL / DEFER / PRIORITIZE / RESERVE
- **APPLY PLAN** really rewrites the timeline — with animation, not just chat text
- Persists everything in `localStorage`; survives refresh

## Tech

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Zustand — 100% local.

## PilotDeck integration

The UI talks to the agent only through an adapter seam:

```
UI (AgentPanel / InsightPanel)
  -> store/workspace.ts
    -> src/lib/pilotdeck/provider.ts         (environment switch)
      -> src/lib/pilotdeck/mockAgentProvider.ts   <-- active: zero-config demo
      -> src/lib/pilotdeck/pilotdeckClient.ts     <-- real SDK stub (SDK_AVAILABLE=false)
    -> src/lib/agent/{goalParser,taskDecomposer,scheduler,riskAnalyzer,replanner,pipeline}.ts
```

The mock provider runs the real planning pipeline, so the whole demo works with no
API key and never falls back to canned text. Swapping in the real PilotDeck SDK is a
drop-in change in `pilotdeckClient.ts` + `provider.ts`.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
```

Verification:

```bash
npm run build      # production build
npm run lint       # eslint (0 errors / 0 warnings)
npm run verify     # agent pipeline unit checks
npm run test:e2e   # Playwright demo walkthrough (21 checks)
npm run test:layout
```

## Demo flow (judge script)

1. Open the workspace → **LOAD HACKATHON DEMO**
2. See 65% TIME USED / 42% WORK DONE / **BEHIND SCHEDULE**, bottleneck **PilotDeck Integration**, risk **HIGH**
3. Type `I only have 3 hours today` → agent detects the constraint → **APPLY PLAN**
4. Timeline animates: Landing Page cancelled, Visual Polish deferred, PilotDeck prioritized, risk drops to **MEDIUM**
5. Click any task → edit progress → risk recalculates live. Refresh → state persists.

## Visual design

The workspace follows Wayline's white and lake-blue identity: a serif brand
wordmark, a skyline and paper-plane route, and spacious planning panels. Warm
terracotta still indicates schedule risk; blue is used for primary controls and
active task bars. Artwork is local SVG in `src/components/WaylineBrand.tsx`, and
shared visual tokens live in `src/app/globals.css`. No external fonts or image
services are needed. On smaller screens, the panels stack and scroll vertically;
reduced-motion preferences disable decorative transitions.

Browser checks use Chrome on macOS by default, or Playwright's installed Chromium
on other platforms. Set `CHROME_PATH` to use a different browser executable and
`BASE_URL` when the development server runs on a different port:

```bash
BASE_URL=http://localhost:3011 npm run test:e2e
BASE_URL=http://localhost:3011 npm run test:layout
```

## 轻量路书试用

工作台增加「今日 / 计划 / 回顾 / 问路」菜单，默认仍打开计划页。
今日支持快速记录、完成与删除，也可选择现有计划任务；完成关联任务会同步更新时间线与风险。
随手记和每日选择单独保存在 `wayline-daybook-v1`，计划数据仍使用原有存储。
回顾目前只统计随手记的完成记录，支持撤销完成，不推断旧计划的历史完成日期。
顶部重置、导入和导出操作仍只作用于计划工作台，不包含随手记。
问路使用三枚硬币法随机生成六爻，展示卦名和可选的小行动，可加入今日。
卦象与小行动用于娱乐和自我反思，不参与计划排期或风险计算。
