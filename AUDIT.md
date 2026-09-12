# WAYLINE repository audit

- App Router, Next.js 16.3.4, React 19, Zustand persistence; no Pages Router, IndexedDB, account or backend.
- Existing reusable behavior: project scheduling, progress/capacity metrics, deterministic project risk, timeline, task editor, staged replan, and a mock/PilotDeck adapter seam.
- Existing split: `vd-workspace-v1` owns one project while `wayline-daybook-v1` owns notes/selections; neither is a unified task queue.
- Repository history contains no Heat Zone, Eisenhower Matrix, Top 3, or task-level pressure/urgency implementation.
- VisualDeadline's deployed `importance-urgency-v1` behavior was therefore captured as compatibility tests before reuse: deadline buckets, `importance × urgency × remaining progress`, Top 3 score, and matrix coordinates.
- PilotDeck SDK/API is not installed or documented. The real adapter remains explicit; local deterministic understanding is the verified fallback.
