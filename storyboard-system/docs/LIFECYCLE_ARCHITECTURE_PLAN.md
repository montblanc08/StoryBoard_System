# FrameForge 全生命周期架构实施方案

状态：2026-09-24，本地实施中；生产环境保持现状，用户已明确暂停部署。本方案以当前代码和用户提交的 UI 审查为输入，阶段完成以代码与验收证据为准。

两份后续架构要求所提出的模块化单体、FastAPI/PostgreSQL/React 演进、Command/Event、AI Proposal、i18n 和可观测性已细化为 [架构迁移契约](ARCHITECTURE_MIGRATION.md)。该文档区分现有运行事实与目标技术栈，并定义每条迁移的测试、删除旧实现及回滚门槛。

截至本轮，后端已有字段生命周期、素材清理、旁白计时、交付格式、单镜头与批量镜头更新、导入解析与暂存、SQLite 旧列基线迁移等独立模块；共享 UI 包建立浮层与动效状态契约，搜索结果的选中/详情状态已归一，PDF 页面模板及 PDF/Word 图片预检已从 `static/app.js` 移到单独模块。只读结构清点工具可对比离线数据库副本；SQLite backup→恢复工具已在合成库验证，但尚未完成实际业务数据、媒体和存储键的备份恢复演练。`server.py` 和 `static/app.js` 仍是大文件，路由和多数业务视图尚未拆完。目标 FastAPI/PostgreSQL/完整 React 迁移尚未开始，不能把这些切片视为重构完成。新增可编辑 Word 分镜表导出已接入现有导出弹窗并通过本地文件与浏览器验收。

## 目标和不可变约束

从项目创建、导入、镜头编辑、素材/画板制作、审阅、交付到归档/删除，每个实体只有一个持久化事实来源；表格、卡片、时间线、审片、旁白和导出只读取相同实体并维护各自的显示状态。现有真实 `.xlsx` 导入、字段映射和图片导入继续可用；测试工作簿不进入发布包。所有删除先根据持久引用预览影响，提交成功后才清理无引用文件。已保存的历史版本和分享快照不因当前视图隐藏列而被改写。

## 所有权与状态边界

| 层 | 唯一所有者 | 允许的状态 | 禁止的交叉依赖 |
| --- | --- | --- | --- |
| Domain | 服务端 SQLite/API；客户端规范化 Shot/Field/Asset/Revision/Board 数据 | 实体 ID、版本号、内容、生命周期 | 视图 CSS、抽屉开关、浏览器焦点决定数据内容 |
| Workspace UI | 单一 `selectionStore`、`inspectorStore`、`viewStore`、`modalStore`、`layoutStore` | 选中 ID、面板开合/模式、当前视图、最顶层弹窗、面板尺寸 | 选中镜头自动等于打开详情；跨 feature 复用临时面板状态 |
| Feature UI | Table/Card/Timeline/Review/Narration/Moodboard/Lighting 自己的 adapter | 排序、过滤、局部编辑、当前 revision 或画布相机 | feature 再造全局 Shot、独立改写其他视图数据 |
| Design system | `packages/ui` 和统一 shell/token/motion | 控件语义、键盘焦点、浮层、间距、状态动效 | 同一语义控件在页面里各写一套高度/描边/关闭/动画规则 |
| Service | API、保存队列、导入、交付导出和默认关闭的 AI provider registry | 请求、冲突、重试、取消和结果 | UI 层直接访问数据库/文件或未经确认自动写回 AI 输出 |

当前 `static/app.js` 仍有大的共享 `state`，`src/workspace` 与手写静态模块并存。本轮已开始把选中与 `inspectorOpen` 的触发分开，但还没有完成上述 store 迁移；迁移一个调用方后要删除被替代的旧路径，避免双写和永久转接层。

## 用户旅程与实体生命周期

| 实体/流程 | 状态与合法转换 | 持久化、恢复与删除规则 | 验收 |
| --- | --- | --- | --- |
| Project | active → archived → restored 或 purged | archive 保持镜头与资产引用；purge 在数据库事务提交后清理仅属于该项目且不再被引用的媒体；失败不删文件 | 项目卡、菜单、归档恢复和错误回滚 |
| Shot | draft → ready for review → approved / changes requested → resubmitted；active → trash → restored / purged | 稳定 shot ID 与 revision；批量和单条操作同一 API；trash 保留 30 天恢复入口，purge 再检查媒体引用 | 表格/卡片/时间线/Review 同步；多选、撤销与冲突 |
| Field | active ↔ archived；archived → purged | `custom_field_definitions.id` 保持不变；创建后 key 固定。统一服务端字段 schema 与客户端投影；purged 不再被旧 view config、localStorage、导入映射复活。当前后端用 `state='removed'` + `permanently_deleted`，迁移时先读旧值再一次写新状态 | 列管理、右键菜单、保存视图、重载、导入、永久删除后不回表头 |
| Asset | staged → active → unreferenced → purged | 项目镜头、画板、制作步骤、版本、快照、有效分享链接均纳入引用判断；清理预览与执行使用同一规则；删除数据库记录成功后再删存储文件 | 未使用素材数量、受保护原因、并发引用与失败回滚 |
| Creative Board | local draft → saving → saved / rejected / conflict | Moodboard V1 与 Lighting V2 使用各自 serializer；400/422 拒绝版本停止自动重试，保留本地草稿；409 走冲突处理 | 新建、图片/便笺保存、重载、离开备份和失败状态 |
| Revision/Review | snapshot → selected revision → decision | 审片镜头和选择的修订是 feature scope；同意/驳回必须携带明确 revision ID、目标与确认。历史快照只追加或按显式恢复流程变更 | 空版本不可审批、取消无写入、重载后决策绑定正确版本 |
| Import/Export | uploaded/staged → preview/mapping → confirmed → committed；export configured → preview → generated | 真实 Excel 导入的 append/update/replace 保持事务语义；替换前列明影响并整批回滚。PDF/Word/EDL/SRT 等导出使用同一呈现模型和镜头范围；文档类型、版式、范围、字段独立选择。Word 输出真正的可编辑 `.docx`，嵌入兼容图片 | 测试工作簿不随包、密集横版分页、缺图提示、导出与数据一致 |
| AI（未来） | disabled → configured → request preview → human accepted → committed / discarded | 默认关闭、无 UI、无外部请求；provider 与 capability 明确注册，输入按项目权限过滤，输出先成为草稿/建议，人工确认才写入；保留可追踪的 provider/版本/来源 | 禁用时零外发/零写入，启用后的权限、审计、取消与幂等契约 |

## 交互契约与布局

1. 单击镜头只改变选择；双击或显式“详情”打开 Inspector。切视图关闭未固定的 Inspector，镜头删除清理失效 selection。Review 的 revision 选择只存在 Review scope，不写成全局当前镜头。
2. Inspector 明确 `overlay` 或 `docked` 模式。docked 必须让主内容重排，overlay 不改主内容宽度；同一视图不混合两种布局。Modal 按栈处理 Esc，只关闭顶层；未保存草稿有独立离开确认。
3. Shell 统一 Global Header、Workspace Header、Nav Rail、Left Panel、Main Stage、Inspector 的尺寸 token 和滚动容器。项目大厅另有响应式容器，但标题、操作、列表共享左边界。卡片/表格/时间线使用同一 ShotQuery；时间线 clip 宽度按时长映射。
4. 鼠标点击后的 selected/active 用中性背景、边缘或小标记；蓝色 focus ring 只给键盘 `:focus-visible`。键盘：Enter 执行上下文操作，textarea Enter 换行、Ctrl/Cmd+Enter 提交，Esc 取消/关闭顶层，Delete 仅作用于明确选择。
5. UI 组件保留动效、渐隐、半透明和轻微模糊；动效不能遮挡文字、改变命中区域或让保存状态含糊。320px 仅保证主要页面布局；手机 2D/3D 的后续适配遵循用户此前的桌面优先顺序。

## Motion System 与组件生命周期（随架构同步建立）

Motion 是状态变化的反馈协议，不是末尾补上的页面装饰。`packages/ui` 维护唯一的时间、缓动、距离 token 和 `MotionIcon`/`Presence`/`Slide` 等组件接口；业务 feature 只提供 `idle/hover/active/loading/success/error/disabled` 等状态，不直接设置零散的 `element.style.transition`。旧 CSS 中的 `transition: all` 和重复时长应按迁移的组件逐项删除，不能再叠一层覆盖规则。

Shared Workspace Transition 只替换 View Toolbar、Main Content 和 Inspector；Global/Project Header 保持挂载。实体 DOM 使用稳定 `shot:<id>` key 为日后跨 Table/Card/Timeline 的共享元素变化留接口，但第一批只实现有明确状态所有权的转场。Inspector 的主舞台重排与内容进入要同一状态驱动；切换镜头时保持 shell，仅更新内容。浮层按 Menu、Popover、Dialog 各自的层级和时长处理，加载按页面局部上下文反馈。

动画验收除截图外还要检查：状态结束后不残留透明可点击层；Esc/取消时焦点归还；保存/错误结果与真实请求一致；1440/1024 和 320/375 不因动画产生横向溢出；快速切视图或销毁画布时无旧定时器/帧循环继续运行。性能优先 `transform`/`opacity`，画布数值插值只在展示层，持久数据保留准确值。用户此前已撤销低动效要求；本方案不引入全局降低或关闭动效的产品规则。

AI 的既有代码仅有受登录保护的 `GET /api/ai/capabilities` 静态占位响应；它不提供实际生成能力。架构稳定前不新增 AI 调用路径或页面入口。未来 provider 输入只接受权限校验后构造的白名单 DTO，输出为带 capability/schema/source 的待审提案，经人工确认后通过现有领域服务写入，禁止直接取得 DB/session 或整个项目 bundle。

## 分阶段实施与完成门槛

| 阶段 | 交付物和主要文件边界 | 完成门槛 |
| --- | --- | --- |
| 0 基线 | `AGENTS.md`、本方案、入口/数据目录/发布清单、桌面与窄屏截图 | 记录 dirty 状态；辨识运行数据、源码、生成物、可删临时文件；生产不变 |
| 1 UI 与 Motion 基础 | selection/inspector/modal/view/focus 的单一状态契约；共享 Shell/token/motion；`static/app.js` → `src/workspace` 按调用方迁移 | 卡片/时间线不自动弹详情；切视图和删除无泄漏；动效不残留交互层；1440/1024 的键盘/鼠标与浮层截图通过 |
| 2 Schema 与持久化 | `field_lifecycle.py`、字段 API、view config/localStorage 迁移；ShotQuery/Shot command 集中 | 归档/恢复/永久删除跨重载一致；旧配置不会复活 purged 列；真实 Excel 导入不回归 |
| 3 业务视图 | Table/Card/Timeline 共用镜头契约，再迁 Review/Narration | 同一编辑在所有视图一致；自动旁白随语速改变总时长且保护手动锁；timeline 长度按时长 |
| 4 画布与交付 | Moodboard/Lighting 共享 EditorShell 生命周期、独立领域模型；PDF 配置拆维度 | 模式切换释放 WebGL、保存重载、画板自动 fit、横版 PDF 密集字段分页均经浏览器验收 |
| 5 AI 与清理 | 架构稳定后才接入默认关闭的 AI provider 契约、权限/审计测试；移除已无引用旧代码与静态临时文件 | 关闭时界面零元素、网络零外发；目录清理逐文件证据；发布包无测试表格/数据 |
| 6 发布（当前暂停） | 可复现发布包、隔离启动、生产对比、备份与回滚记录 | 仅在用户重新授权部署后执行；先完整桌面验收，再处理手机 2D/3D |

每阶段先固定 API/状态不变量，迁移一条真实调用链，删除旧实现，再跑有意义的合同测试和浏览器截图。`npm run check` 会重建 bundle；运行前检查未提交生成物。发布包只包含运行文件；隔离数据下启动后验证健康、登录、核心操作和静态资源。未经用户新指令，阶段 6 不启动。
