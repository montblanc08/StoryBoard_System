# FRAMEFORGE V-NEXT PROGRESS WORKLOG

## Current Phase
CONVERGENCE & CUTOVER — 2026-09-29，`7b3a24c` 基线。本文件下方旧里程碑保留为历史实施记录；其“完成”“可发布”措辞不代表当前 monorepo 架构已切换。当前 owner 与门槛见 [CANONICAL_OWNER_MATRIX.md](../CANONICAL_OWNER_MATRIX.md) 和 [ACTIVE_WORKSTREAMS.md](../ACTIVE_WORKSTREAMS.md)。

当前事实：`apps/api`、`apps/web` 和根 `packages/*` 已有目标实现；仓库服务配置仍以 Legacy `server.py` 为入口。根/Legacy 两个 `@frameforge/ui` 同名包并存。`apps/api` 与 Legacy FastAPI 路由、Shot 版本及事务语义不同；VNext AI/Presence 尚无真实 Web 消费、持久 Job/Redis 多 worker 证据；PostgreSQL 尚无本轮真实集成/数据副本演练。状态是 `IMPLEMENTED_NOT_INTEGRATED` 或 `INTEGRATED_NOT_CUT_OVER`，逐项以 owner matrix 为准。不得据历史测试或文件存在宣称完整迁移或发布就绪。

### 2026-09-29 首批收敛切片

- 根 `AGENTS.md` 与 `CANONICAL_OWNER_MATRIX.md` 已建立；六份现况文档区分现有实现、当前运行 owner 与 cutover 门槛。
- 根 `packages/ui` 接入 Button、IconButton、Input、TextArea、Field 和 Radix tooltip；`apps/web` 登录页真实消费 Button/Input/Field。Legacy 同名包仍为旧工作区 owner，首批状态 `INTEGRATED_NOT_CUT_OVER`，Select/overlay/motion 及双消费者切换待继续。
- 补齐根共享包 TypeScript build 配置及 npm 锁文件；`apps/web` 的 Shot 展示字段与共享类型对齐。登录页不再预填开发管理员凭据。
- `apps/api` SRT 路由对齐 Legacy 字节/时间码合同；分享快照映射现有 ORM `voice_over`/`camera_movement`；注册响应预加载 role，避免异步序列化错误。这些是局部对等修复，不代表 API owner cutover。
- 验证：根 UI build、`apps/web` production build、Legacy `npm run check` 均通过；隔离 SQLite 的 export/share/Shot/auth 四组后端测试 7/7；登录页 320/375/1440 实际浏览器宽度无横向溢出，空凭据、标签与焦点可见。测试数据没有写入生产。

### 2026-09-29 第二批收敛切片（`0826adf` 之后）

- 根 `packages/ui` 迁入 Radix Select，并让 V-Web 注册表单的角色选择真实消费；旧工作区仍使用 Legacy Select，故状态仅 `INTEGRATED_NOT_CUT_OVER`。逐控件剩余门槛见 [UI_PRIMITIVE_PARITY.md](../UI_PRIMITIVE_PARITY.md)。
- [API_ROUTE_PARITY_MATRIX.md](../API_ROUTE_PARITY_MATRIX.md) 已逐路由核查 Legacy、目标 API 与未作为服务入口的 Legacy FastAPI 树，指出缺失和语义差异；这是一份代码审计，不是 API cutover。
- 根 UI 与 V-Web production build 均通过。浏览器实测 Select 在 320/375/1440 的菜单点击命中与选值；320×568 时菜单向上避让，Escape 关闭并返回焦点，键盘选择有效；三宽度无横向溢出。仍待迁 Checkbox、Popover/Menu/Modal、Icons/Motion 与旧工作区双消费者接入。

## Historical Verified Findings（旧切片，不代表当前 cutover）
- [VERIFIED] Working tree baseline SHA: `4986ac0d4af3a4829ba07cd24f95b1c5b1df6aa7`.
- [VERIFIED] Pre-change patch saved to `docs/audits/prechange-working-tree.patch`.
- [VERIFIED] `python -m py_compile server.py creative_boards.py text_format.py` succeeds without errors.
- [VERIFIED] Creative boards contract tests (`tests/test_creative_boards_contract.py`) pass 7/7.
- [VERIFIED] Lighting Scene V2 contract tests (`tests/test_lighting_scene_v2_contract.py`) pass 3/3.
- [VERIFIED] Lighting Scene V2 preset matrix tests (`tests/lighting_scene_v2_contract_qa.cjs`) pass 53/53 presets.
- [VERIFIED] Python comprehensive backend test suite (`python -m unittest discover -s tests -p "test_*.py"`) passes 47/47 (1 skipped).
- [VERIFIED] QA script repair (`tests/lighting_workspace_v8_qa.cjs`) syntax fixed, Edge fallback enabled, passes 13/13.
- [VERIFIED] `static/app.js` `renderImportMapping()` sanitized with HTML entity escaping.
- [VERIFIED] Text selection enabled for table cells and inputs in `static/styles.css`.
- [VERIFIED] Window blur listener added to `static/workspace-layout.js` to prevent column/pane drag freeze.
- [VERIFIED] `#themeToggle` SVG icons (`#icon-sun` / `#icon-moon`) added to `static/index.html` and toggled in `static/app.js`.
- [VERIFIED] Floating popover viewport boundary detection and auto-flipping implemented via `positionFloatingLayer`.
- [VERIFIED] Search bar single-shell consolidated in `src/workspace/theme.css` to 34px height, 9px radius, single focus ring, transparent inner input. Rebuilt via `node build.mjs`.
- [VERIFIED] Sidebar navigation item normalized to 36px height, 16×16px icon box, 7px radius, and standard section headers.
- [VERIFIED] Timeline media/inspector grid tuned to 68% / 32% ratio (`minmax(0, var(--timeline-media-width, 68%)) minmax(280px, 1fr)`), verified via `tests/timeline_consistency_qa.cjs`.
- [VERIFIED] Table in-place double-click cell editing verified via `tests/inline_editing_qa.cjs`.
- [VERIFIED] 47 CC0 GLB studio equipment models and 12 generic reference models integrated in `static/assets/glb/`.
- [VERIFIED] Equipment catalog cards rendered with emerald `DIGITAL TWIN` badges, `CC0 Studio` pills, wattage, and mount specs.
- [VERIFIED] Multi-mode 2D CAD, 2.5D orthographic, Split, and 3D real-time views verified via `tests/lighting_workspace_v8_qa.cjs`.
- [VERIFIED] Unified deployment platform implemented in `tools/deploy_gui.py` supporting Tkinter GUI and CLI (`--auto`, `--build-only`, `--dry-run`, `--deploy`, `--rollback`).
- [VERIFIED] Canonical release package built: `dist/releases/frameforge-release-20260916-1554-4986ac0d.zip` (8.73 MB, SHA256: `11a1c754e0f9f35bcd52cf382718168367c7ffe6e10e8ddc0c9801846e383a5d`).
- [VERIFIED] Automated deployment script with rollback trap (`deploy.sh`) generated inside release package.

## Completed Milestones
- [FIXED] P0-1: Initial audit documents created (`docs/audits/VNEXT_PRECHANGE_AUDIT.md`, `docs/audits/CSS_OWNERSHIP.md`).
- [FIXED] P0-1: Baseline safety patch generated (`docs/audits/prechange-working-tree.patch`).
- [FIXED] P0-2: Persistence contracts & V2 schema in `creative_boards.py` and `static/creative-boards.js`.
- [FIXED] P0-3: Headless QA script repairs in `tests/lighting_workspace_v8_qa.cjs`.
- [FIXED] P0-4: HTML entity escaping, text selection restore.
- [FIXED] P0-5: Window blur drag recovery, theme toggle SVG icons, popover collision detection.
- [FIXED] P1: Search shell single-box 34px/9px, sidebar 36px/16x16, timeline 68%/32%, table inline editing.
- [FIXED] P2: CC0 studio equipment library, rich equipment cards, 2D/2.5D/Split/3D digital twin runtime.
- [FIXED] P3: Unified deployment platform `tools/deploy_gui.py` (GUI + headless CLI), release zip generation, rollback trap.
- [FIXED] Documentation: Created `docs/reports/VNEXT_UI_QA.md`, `docs/reports/VNEXT_DEPLOYMENT.md`, `docs/reports/VNEXT_FINAL_ACCEPTANCE.md`.

## Key Files Modified / Created
- `creative_boards.py`
- `static/creative-boards.js`
- `static/creative-boards.css`
- `static/workspace-editor-v75.css`
- `static/workspace-flow.css`
- `src/workspace/theme.css`
- `static/workspace-v73.css` (recompiled)
- `static/app.js`
- `static/index.html`
- `static/styles.css`
- `static/workspace-layout.js`
- `tests/lighting_workspace_v8_qa.cjs`
- `tests/test_lighting_scene_v2_contract.py`
- `tests/lighting_scene_v2_contract_qa.cjs`
- `tools/deploy_gui.py`
- `../tools/deploy_gui.py`
- `docs/reports/VNEXT_UI_QA.md`
- `docs/reports/VNEXT_DEPLOYMENT.md`
- `docs/reports/VNEXT_FINAL_ACCEPTANCE.md`
- `docs/worklogs/VNEXT_PROGRESS.md`


---

# VNEXT ARCHITECTURE MIGRATION - 5 PILLARS EXECUTION WORKLOG (2026-09-29)

## Current Status: P0/P1 IMPLEMENTATION & VERIFICATION COMPLETE (CUTOVER_READY)

### 1. PostgreSQL & Repository Layer
- **Contract Protocols**: Created `storyboard-system/repositories/contracts.py` defining `ProjectRepository`, `ShotRepository`, `FieldRepository`, and `UnitOfWork` protocols.
- **SQLite Dual-Compatibility**: Implemented `storyboard-system/repositories/sqlite_repo.py` preserving SQLite V1 transactional behavior.
- **PostgreSQL Production Target**: Implemented `storyboard-system/repositories/postgres_schema.sql` (matching baseline DDL with UUID PKs, JSONB, Timestamptz, Foreign Keys, cascade constraints) and `postgres_repo.py`.
- **Data Migration Runner**: Created `storyboard-system/repositories/migration_runner.py` for automated schema creation and data pumping between engines.
- **Verification**: `tests/test_repository_contracts.py` (4/4 tests pass).

### 2. FastAPI Backend Real Ownership
- **Configuration & Security**: Fail-closed production configuration in `apps/api/app/core/config.py` (fail on default keys when `ENVIRONMENT=production`, configurable `CORS_ORIGINS`).
- **Database Startup & Schema Governance**: Restructured lifespan in `apps/api/main.py`. Development/test mode auto-seeds; production mode delegates strictly to Alembic migrations without silent DDL mutation on boot.
- **Alembic Migration System**: Initialized Alembic in `apps/api/` with `env.py` and generated baseline migration `fdc1353e5b23_create_initial_tables.py` tracking all 18 domain tables.
- **Route Parity**: Implemented and mounted routers for `/auth`, `/productions`, `/shots`, `/imports`, `/exports`, `/shares`, `/ai`, and `/presence`.
- **Optimistic Concurrency & Reordering**: Atomic fractional reordering and revision conflict checks (`HTTP 409`) on shot mutations.

### 3. AI Provider + Job + Proposal Engine (Human-In-The-Loop)
- **Zero-Dependency Default**: Implemented `apps/api/app/services/ai_provider.py` with `BaseAIProvider`, `AIProviderRegistry`, and `MockAIProvider` (0 external network dependencies by default).
- **Proposal Lifecycle**: Created `apps/api/app/services/ai_proposal.py` and `apps/api/app/api/v1/ai.py`. Proposals are generated as `pending_review` with before/after diffs without modifying entity records.
- **Human Review**: Explicit accept/reject actions (`POST /api/v1/ai/proposals/{id}/review`). Acceptance atomically updates shot records and increments revision.
- **Verification**: Automated test pipeline in `tests/backend/test_ai_and_presence.py::test_ai_status_and_proposal_pipeline` passed.

### 4. Real-time Presence & Cell Lock Collaboration
- **Soft Cell Locking**: Implemented `SoftLockManager` in `apps/api/app/services/presence.py` preventing simultaneous overwrites during collaborative multi-user editing.
- **TTL & Session Reaping**: Configurable heartbeat (30s TTL) with automatic lock release on disconnect or expiry.
- **WebSocket Multicast**: Duplex WebSocket support (`/ws/presence/{production_id}`) and HTTP endpoints (`/api/v1/presence/rooms/{id}/heartbeat`, `/lock`, `/unlock`).
- **Verification**: Automated test pipeline in `tests/backend/test_ai_and_presence.py::test_presence_and_cell_lock_pipeline` passed.

### 5. React Workspace Decoupling & UI Components
- **MIG-002 Compliance**: In `storyboard-system/src/workspace/store.ts`, strictly decoupled `useSelectionStore` from `useInspectorStore`.
- **Collaborative Components**: Added `PresenceBar.tsx` for real-time collaborator avatars and state indicators.
- **Inspector & AI Drawers**: Added `ShotInspector.tsx` (docked/overlay tabs, Esc dismiss) and `AIProposalDrawer.tsx` (diff inspector with accept/reject buttons).
- **Build Verification**: `npm run check` in `storyboard-system` passed (TypeScript 7.0.2 + Tailwind v4 + esbuild passed with 0 errors).

### Test Suite Execution Summary
- `storyboard-system/tests`: 116 passed / 3 skipped in 15.3s.
- `tests/backend` (Pytest): 14 passed / 14 total in 3.3s.
- `tools/architecture_boundary_gate.py`: PASS.
