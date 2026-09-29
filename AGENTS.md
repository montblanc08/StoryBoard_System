# FRAMEFORGE — Repository Constitution & Agent Rules

This document governs the repository. User instructions in active conversations take precedence.
`storyboard-system/AGENTS.md` governs Legacy-specific work inside that subtree.

---

## 1. Canonical Target Architecture

FRAMEFORGE converges from a hybrid Legacy architecture to one canonical target:
- `apps/web`: Canonical Web UI (Next.js 15, React 19)
- `apps/api`: Canonical backend API (FastAPI, async SQLAlchemy 2)
- `packages/*`: Canonical shared packages (`@frameforge/ui`, `@frameforge/types`, `@frameforge/contracts`, `@frameforge/timecode`)
- PostgreSQL: Persistent database target (Alembic-owned migrations)
- Redis: Ephemeral Presence backend target (TTL / pubsub)

`storyboard-system/` remains an active Legacy/migration source until each runtime responsibility has been cut over.
Do not introduce parallel architectures.

---

## 2. Migration States & Single Owner Invariant

A file, route, component, or test existing does NOT mean migration is complete.
Classify capabilities into:
- `VERIFIED`: Proven in runtime/code audit
- `IMPLEMENTED_NOT_INTEGRATED`: Code exists, not wired to real consumer
- `INTEGRATED_NOT_CUT_OVER`: Real consumer uses target; Legacy still authoritative
- `CUTOVER_READY`: Parity proven, rollback rehearsed
- `CUT_OVER`: Target is authoritative production entry point
- `LEGACY_RETIRED`: Old owner deleted or has zero consumers
- `BLOCKED`: Upstream prerequisite missing

**Single Owner Rule**: One capability = one authoritative owner. Identify DOM/Render, State, Event, Request, Mutation, and Persistence owners before implementing. Never maintain parallel authoritative owners.

---

## 3. Safety Invariants

- **No Production Deployment**: Local implementation, tests, builds, and synthetic rehearsals only. Never mutate real production environments or databases without explicit authorization.
- **Fail-Closed Configuration**: In `ENVIRONMENT=production`, missing secrets/passwords must fail fast. Never hardcode credentials.
- **AI Invariant**: Zero outbound AI network calls by default. Outbound calls require explicit configuration. Proposal mutations must pass human review (`Provider → Proposal → Human Review → Standard Command → Audit`).
- **Presence Invariant**: Presence data (cursors, viewport, cell locks, heartbeats) is strictly ephemeral. Never persist presence into persistent PostgreSQL tables.
- **Save Semantics**: Preserve `dirty`, `saving`, `acknowledged`, `failed`, `conflict (409)`. State is saved only upon server acknowledgement.

---

## 4. UI Layer Boundaries & Design System

- **Primitive** (`@frameforge/ui`): Knows zero FRAMEFORGE business logic or product strings. shadcn/Radix baseline, neutral palette, accessible.
- **Pattern**: Composed interaction patterns (modals, inspectors, split panes).
- **Domain**: Knows film and storyboard concepts (shots, reels, timecodes).
- **Feature** (`apps/web`): Owns queries, mutations, permissions, routes, and business state.
- **State Ownership**: Server state via query/hooks; workspace UI state via single Zustand store; selection & inspector targets independent but unified in workspace store; form drafts local. Avoid duplicate state owners.

---

## 5. Backend Invariants

- **Router Boundary**: Routers own HTTP parsing, auth, permissions, schema validation, and status mapping. Routers do NOT own business workflows or raw SQL.
- **Service & Command Layer**: Business mutations must flow through dedicated Application Services or Command Handlers ensuring revision increment, audit logging, and `409 Conflict` detection.
- **Persistence Ownership**: Alembic owns schema history in production. `Base.metadata.create_all` is restricted to development/test fixtures.

---

## 6. Legacy Freeze & Deletion Protocol

- Legacy (`storyboard-system/`) is frozen: only critical fixes, security patches, or migration adapters allowed.
- Never delete a legacy file simply because it looks old. Verify all imports, dynamic loaders, templates, and build manifests first. Delete only when legacy owner has zero consumers.

---

## 7. Execution & Git Discipline

- **Context Protocol**: Check `git status` and `ACTIVE_WORKSTREAMS.md` first. Use narrow search (`rg`, `git diff`) before reading files.
- **Start of Task**: Verify HEAD, dirty working tree, and recent commits. Never overwrite dirty work.
- **Testing Order**: Targeted unit → targeted integration → build/typecheck → full regression.
- **Git Commit Policy**: Focused, descriptive commits (`refactor(ui)`, `feat(exports)`, `docs(matrix)`). Always push and verify test pass before ending milestones.

---

## 8. Dynamic Status & Task Tracking

Dynamic status, parity tables, and current workstreams are strictly decoupled from this constitution:
- Current Task Board & Milestones: `storyboard-system/docs/ACTIVE_WORKSTREAMS.md`
- Capability Ownership Matrix: `storyboard-system/docs/CANONICAL_OWNER_MATRIX.md`
- API Route Parity: `storyboard-system/docs/API_ROUTE_PARITY_MATRIX.md`
- UI Primitive Parity: `storyboard-system/docs/UI_PRIMITIVE_PARITY.md`
- Execution Worklogs: `storyboard-system/docs/worklogs/VNEXT_PROGRESS.md`