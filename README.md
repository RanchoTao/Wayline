# VisualDeadline Agent

> **VisualDeadline Agent turns vague goals into visible, adaptive execution plans.**
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
