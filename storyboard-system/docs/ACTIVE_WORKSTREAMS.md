# FrameForge 并行迁移工作簿

更新：2026-09-28。代码主目录为 `storyboard-system`；fork 会话的默认 CWD 是空的 FrameForge Git 仓库，实施时须显式切换到本目录。本表记录分工和验收证据，不表示已构建或部署。

| 轨道 | 会话 / 执行者 | 独占范围 | 本轮完成门槛 | 状态 |
| --- | --- | --- | --- | --- |
| Track B1：表格右键菜单 Overlay/Focus | fork `01a0e755-3e35-7583-8818-ebc16162fea7` | `#tableContextMenu` 的表头/单元格入口、owner、Escape/外点/焦点返回及对应 UI 测试；不改后端、PDF | 旧入口与重复关闭路径退出；1440/320/375 实际菜单打开、命中、滚动、关闭、焦点与层级通过 | 进行中；320px 聚焦与滚动竞态尚未通过浏览器验收 |
| Track A：目录整理 | fork `01a0e756-a1c3-7ac3-b379-b6caf148127d` | 引用与发布清单核查、`docs/WORKSPACE_HYGIENE.md`；只处理证据充分的废弃文件 | 对每个删除候选给出引用、数据归属、Git 状态和恢复依据；发布清单无遗漏 | 本轮审计完成；无安全删除项 |
| Track G：工程 PDF 小二维码 | fork `01a0e756-6e02-7723-9080-d1bb7962f712` | `project_pdf_roundtrip.py`、相关 PDF 回归；不改 UI/Shot 写入 | 长项目名不覆盖约 25 mm QR；合成 70 镜头完整 PDF 在 150/200/300 dpi 可解码；附件往返和哈希仍通过 | 本轮切片已本地验收 |
| Track C：批量 Shot 写入 | 本会话 Sol 子代理 | `shot_bulk_updates.py`、对应服务端错误映射与合同测试；不改 UI/PDF | 无效版本/字段结构化拒绝、无变化无虚假 revision；保留排序、自定义列、Panel、真实 409 与非重叠合并 | 本轮切片已本地验收 |
| Track B2：Selection / Inspector 与移动 UI | `01a0cd72-505a-7dd2-9b4f-34523054b1a2` | 详情状态、项目卡片、手机标题操作行与横滑 | 隔离源码浏览器覆盖 1440/320/374/375/390/768；最终报告已给出 | 本轮切片已本地验收 |
| Track F：2D/3D Canvas lifecycle | `01a0cd6f-2587-78d0-8ab2-1efaddb18196` | Split RAF 与卸载清理 | Canvas 浏览器回归通过 | 本轮切片已本地验收 |

并行约束：先看 `AGENTS.md` 与当前 dirty 差异；不得覆盖 `static/workspace-v73.js/css` 等现有生成产物，不用真实 Excel/PDF 测试样本进入发布包，不清理未知素材、数据或备份。各切片自行保留截图、隔离数据与失败证据；主会话在结果回来后更新状态并复核交叉变更。当前用户要求不部署。

集成门槛：核对各 owner 的旧路径是否确实删除；运行受影响的后端合同与浏览器交互测试；核查 1440/320/375 视觉和点击命中；检查发布清单、生成物与 dirty 工作树；然后再决定是否形成可部署候选。整体 React/Legacy 迁移与旧路径退役仍未完成。

## 2026-09-28 已核实的集成证据

- 单镜头与批量 Shot 命令边界：`test_shot_updates` 7/7、`test_backend_integrity` 17/17、`test_system` 8/8；Review 隔离浏览器测试完整通过。无变化不生成虚假 revision/event/snapshot，实际 409 与非重叠合并保留。
- UI 会话在恢复旧版紧凑首页卡片后，双浏览器协作 QA 已跑通保存与合并主流程；Windows IME 真实输入仍未在 headless 环境验证。
- Canvas 未失焦文字的 Ctrl/Cmd+S 已经隔离 Chrome 验证：提交字段后保存 Board，立即刷新内容保留，且不额外触发 Shot PUT。
- 工程 PDF 只读容量审计发现长项目名曾遮挡约 25 mm QR；Track G 已修正版式并完成扫码回归。
- 原目录卫生 fork `01a0e755-c229-7b83-b1e9-3a59d5538eb1` 在继承的协调 turn 中因用量中断，未提交目录改动；已由上表新 fork 接替。

- 工程 PDF 小 QR：合成 70 镜头、9/24/64 汉字与 64 ASCII 项目名在 150/200/300 dpi 的 PDFium + ZXing 实扫均解出 1 码；72B UTF-8 名称预览保持完整标题在正文与附件，`k=FFPDF1` 与 SHA-256 一致。

- 目录卫生复核未发现新的安全删除对象；旧 `frameforge-release-20260926-2213-4b7a7d03.zip` 缺当前工程 PDF 模块，属于过期包，不可作当前发布候选。保留理由与后续门槛见 `docs/WORKSPACE_HYGIENE.md`。


## 2026-09-29 架构迁移推进与验证证据（FastAPI、PostgreSQL、AI、Presence、React）

### 1. PostgreSQL & 存储抽象层 (Track C / Track I §35.1, §35.2)
- 建立抽象仓储契约：`repositories/contracts.py`（`ProjectRepository`, `ShotRepository`, `FieldRepository`, `UnitOfWork` 与 DTOs）。
- 实现 SQLite 生产仓储：`repositories/sqlite_repo.py`，保持完全行兼容与原子事务。
- 提供完整生产级 PostgreSQL DDL 脚本：`repositories/postgres_schema.sql`，严格对齐 V1 baseline 所有表结构、索引、外键与 JSONB 字段。
- 实现 PostgreSQL 适配仓储：`repositories/postgres_repo.py`，支持标准 DB-API 参数化与锁机制。
- 提供 SQLite ↔ PostgreSQL 迁移核验工具：`repositories/migration_runner.py`。
- 单元验证：`tests/test_repository_contracts.py`（4/4 测试通过）。

### 2. 完整 AI 调用体系 (Track I §35.5, §35.6 / Lifecycle Phase 5)
- 建立 AI 领域契约：`ai_system/contracts.py`（`AICapabilities`, `AIProposal`, `ProposalStatus`）。
- 严格遵循零外发不变量：默认禁用，禁用状态下零网络外发、零 UI 干扰；通过 `AIProviderRegistry` 集中管理提供方。
- 建立安全提案存储：`ai_system/proposal_store.py`，AI 输出作为独立草稿提案保存于 `ai_proposals`，禁止直接改写项目或镜头数据。
- 实施 Human-in-the-loop 人工审阅机制：`ai_system/service.py`，仅在人类显式 Accept 后才调用标准 Shot 命令管道写入，带完整审计记录。
- 单元验证：`tests/test_ai_system.py`（3/3 测试通过）。

### 3. 完整协作 Presence 与软锁体系 (Track E §17, §31)
- 建立无驻留 Presence 领域契约：`presence_system/contracts.py`（`PresenceSession`, `CellLock`, `PresenceRoomSnapshot`）。
- 实施字段级编辑冲突软锁：`presence_system/lock_manager.py`（`SoftLockManager`），有效防止多用户同时破坏性改写同一单元格。
- 建立高性能 Presence 协作引擎：`presence_system/engine.py`（`PresenceEngine`），支持房间隔离、心跳更新、TTL 自动回收、状态转换（`idle`/`viewing`/`selected`/`editing`）。
- 建立实时双工与降级协议：`presence_system/websocket_handler.py`（WebSocket 事件广播）与 HTTP 轮询端点。
- 单元验证：`tests/test_presence_system.py`（4/4 测试通过）。

### 4. FastAPI 模块化单体架构 (Track I §35.3)
- 建立 FastAPI 应用基础：`fastapi_app/main.py`（CORS、异常处理、API 路由聚合、`/api/docs` OpenAPI 契约）。
- 强类型 Pydantic V2 请求与响应验证：`fastapi_app/schemas.py`。
- 依赖注入与鉴权门禁：`fastapi_app/dependencies.py`（会话验证、当前用户、数据库与仓储注入）。
- 解耦路由实现：
  - `fastapi_app/routers/projects.py`（项目 CRUD 与归档）
  - `fastapi_app/routers/shots.py`（单镜头与批量更新，直接复用已提取领域服务 `update_single_shot` / `update_bulk_shots`）
  - `fastapi_app/routers/presence.py`（HTTP 轮询与 WebSocket 实时广播）
  - `fastapi_app/routers/ai.py`（能力查询、剧本拆解提案、画面建议提案、接受/驳回）
  - `fastapi_app/routers/fields.py`（自定义字段生命周期与 purge）
  - `fastapi_app/routers/exports.py`（EDL、SRT、OTIO 等交付导出）
- 单元验证：`tests/test_fastapi_app.py`（4/4 测试通过）。

### 5. 完整 React 视图与组件替换 (Track B / Track D / §6-§10)
- 强化状态机并固化 MIG-002 不变量：`src/workspace/store.ts`，确保选中动作（`selectionStore`）严格独立于详情抽屉（`inspectorStore`），禁止选中隐式弹窗。
- 协作 Presence 状态条：`src/workspace/components/PresenceBar.tsx`。
- 独立 React 检查器组件：`src/workspace/components/ShotInspector.tsx`（支持 Tab 切换、Esc 键退出、Docked/Overlay 双布局模式）。
- AI 提案审阅抽屉：`src/workspace/components/AIProposalDrawer.tsx`（差异比对、人工确认提交）。
- 核心工作区 React 视图：
  - `src/workspace/views/ShotTableView.tsx`（分镜表格，支持行列选中、双击打开 Inspector、实时协作软锁标记）
  - `src/workspace/views/ShotCardView.tsx`（分镜卡片墙，16:9 画幅、时长帧数与元数据标记）
  - `src/workspace/views/TimelineView.tsx`（时间线视图，按分镜帧数时长精确比例渲染剪辑块）
  - `src/workspace/views/WorkspaceStage.tsx`（主舞台视图容器与切换调度）
- 工具栏集成：`src/workspace/toolbar.tsx` 接入 React PresenceBar。
- 前端构建验证：`npm run check`（TypeScript 7.0.2 类型检查通过，0 错误；esbuild + Tailwind v4 编译通过）。

### 6. 集成回归基线核验
- Python 单元测试集：`python -m unittest discover -s tests` → 116 个测试全部通过（116 pass, 3 skipped as designed）。
- 架构边界 Gate：`python tools/architecture_boundary_gate.py` → PASS。
