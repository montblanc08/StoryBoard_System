# FRAMEFORGE — Repository Constitution & Agent Rules

This file is the repository-level execution constitution for FRAMEFORGE.
It is intentionally **stable**. Dynamic migration status, tasks, and historical progress belong in ACTIVE_WORKSTREAMS.md or Parity Matrices, not here.

# 1. Canonical Target Architecture & Golden Baseline
- **Functional Golden Baseline**: FRAMEFORGE_PRODUCT_BASELINE = 5e86a0bb11a20ecd631d9c2af66260a73d7c92e7. This commit is the absolute Product Behavior Reference. Do not silently omit a capability that exists at this baseline.
- **Current Architecture Target**: HEAD (master). VNext (pps/web, pps/api) must reproduce the professional functional density of the baseline.
- **Backend Target**: FastAPI + PostgreSQL (SQLAlchemy 2).
- **Frontend Target**: React 19 / Next.js 15 (pps/web).

# 2. Migration Formula
PRODUCT BEHAVIOR (5e86a0b) -> Migrate to -> CURRENT MASTER (e5c23bd+) -> apps/web + apps/api + packages/*
- Do NOT invent new product features (e.g., fake hubs, fake dashboards) that did not exist in 5e86a0b.
- Do NOT create mock endpoints or UI cards for missing pages. If it's missing, build it properly or leave it out, don't fake it.
- **Visual QA Hard Gate**: Any visible UI change requires actual rendered browser visual inspection (BLOCKED_VISUAL). You cannot assume visual completeness from JSX or Tailwind classes alone.

# 3. Code Execution Discipline
- Make the smallest coherent change that advances the migration.
- **No Dirty Overwrites**: Uncommitted work is user work. Do not silently discard.
- **Context Budget**: Use narrow g queries over reading entire files.
- **UI Quality**: Maintain the professional density and IA of 5e86a0b. Do not arbitrarily drop 	abIndex or keyboard events. Do not use generic fallback covers when media exists.
- **State Drafts**: Never let server refetch blindly overwrite a dirty local form draft.
- **Presence**: Ephemeral Presence must be backed by Redis + WebSockets with proper Auth. Do not hook up unauthenticated "fake" Presence to the UI.

# 4. Status Integrity
- Only mark CUTOVER_READY when real functionality, styling, and IA match 5e86a0b.
- Use IMPLEMENTED_NOT_INTEGRATED or INTEGRATED_NOT_CUT_OVER for work in progress.
- Do NOT document something as finished if it still uses mock data, lacks keyboard navigation, or drops baseline features.
