# FRAMEFORGE V7.3 验收清单

依据：完整读取 `C:/Users/Hatsune/Downloads/FRAMEFORGE_V7_3_UI_FIRST_SIMPLE_WORKFLOW.md`（2026-09-11，§0–140）。编制日期：2026-09-13。

> **最新用户覆盖（优先于原文）：现有功能都不做删减，只重新设计前端。所有业务能力和入口必须保留。**
>
> 第一次覆盖明确保留 Table / Card / Wall / Timeline 四视图，并按统一风格重设计；第二次覆盖扩大到全部现有功能，包括分享、审批、审阅请求、状态、画布模式等。四视图、分享、审批及其他业务功能均不作为禁止项。禁止项只针对未样式化控件、冗余视觉、颜色字号不一致等 UI 问题。
>
> 因此原文 §0–7、21、37–38、51、56–58、62–68、80–81、98、103、107、126–129、132–140 等涉及移除、隐藏或限制既有能力/入口的条款，均按此覆盖改为“保留功能与入口、重设计 UI”。其余组件、布局、字体、色彩、媒体、交互、性能与技术栈要求继续适用。不能通过删除功能、隐藏入口、清除状态或缩减导出格式达成 UI 验收。尚未实现的能力不虚构为既有能力，须按实际基线登记。

当前验收结论：**待验证**。本文仅建立验收标准，未运行浏览器、未修改数据库、未执行功能或性能测试，未采集截图。源码存在某个入口、旧测试或 README 中的“已实现”均不代表 V7.3 通过。

## 1. 使用规则与发布门槛

- 稳定编号格式：`V73-P0-xx-yy`、`V73-P1-xx-yy`、`V73-SS-xx`、`V73-BAN-xx`、`V73-MIG-xx`。后续只追加编号。本次用户覆盖保留原编号并修订判定标准，BAN-04/14/15/16/17 明确撤销功能禁令、改为视觉检查，不沿用旧失败口径。
- 本文所有当前项均为“待验证”；执行后才允许附证据并更新为通过、失败或阻塞。不得以实现计划、安装依赖、构建成功或旧版截图代替验收。
- P0 顺序对应需求 §128 的 P0.1–P0.12；P1 包含 Moodboard、Scene Plan、Electron polish，以及 §73 的 Wipe/Overlay。优先级是实施顺序，不是免验范围。
- 追加 P0.13 作为“全部现有能力与入口保留”的跨页面回归门槛；即使某页面重设计列为 P1，其已有能力也不能在 P0 迁移阶段丢失。
- V7.3 最终 PASS 须覆盖按最新用户指令修订后的 §140：全部现有功能与入口保留、四视图统一重设计、组件库统一、既有业务回归可用、成熟的两个画布、Web/Electron 一致及性能达标。原文“单主工作台/无 View Switcher/无审批”等条件已撤销；不能将“P0 完成”称为“V7.3 完成”。完整 P1 及截图也须有证据。
- 任一当前 UI Release Blocker 命中或既有功能/入口丢失即 FAIL；分享、审批、四视图等功能的存在不构成失败。缺少证据保留待验证，禁止宣称 PASS。每项记录构建/提交标识、执行环境、操作、期望与实际、证据路径、执行时间与验收人。
- 本轮仅编辑本文件。React/UI 实现由主代理负责；后续验收涉及写操作时使用独立测试项目和可丢弃数据，不以生产数据库作为样本。

## 2. 当前工程结构与迁移前提

以下为本次只读检查时的结构快照；并行代理可能继续修改，正式验收须重新绑定最终构建。

| 检查对象 | 观察事实 | 对验收的影响 |
| --- | --- | --- |
| `package.json`、`build.mjs` | 当前包名为 `frameforge-material-web-shell`；声明 `@material/web` 2.4.1、esbuild 0.25.12；构建入口为 `src/material-web.js`，输出 `static/vendor/material-web.js` | 当前检查未发现已配置的 React/TS 工作区或 `packages/ui`，不能认定组件库迁移完成 |
| `src/material-web.js` | 注册 `@material/web/all.js` | Material Web 注册不等于 `@frameforge/ui` 统一导入 |
| `static/index.html`、`static/app.js` | HTML 加载多份全局 CSS 与传统脚本；主逻辑使用 DOM 查询、`innerHTML`、全局状态和 `localStorage` | React 接管需核对 DOM、事件、状态与样式的所有权 |
| `static/workspace-layout.js`、`static/apple-workspace.js`、`static/creative-boards.js`、`static/rich-text.js`、`static/screenplay.js`、`static/print-preview.js` | 存在独立布局、画布、文本与预览模块 | 不可只替换主表格后推断所有入口已统一 |
| `static/app.js`、`static/index.html` | 可见 CARDS/WALL/TIMELINE 常量、`workspaceViewTabs`、原生 `<select>`、业务复选框模板、旧制作审批状态文案 | 是需复核的迁移关注点；是否可达、是否仍渲染须在最终版本验证，不能仅靠隐藏入口验收 |
| `server.py`、`creative_boards.py`、`data/` | Python 服务及 SQLite 相关代码存在 | 保持业务契约与数据兼容；本次不读取或修改数据库内容 |
| `tests/`、`qa-artifacts/`、`docs/` | 有旧版行编辑、列管理、重排、媒体、版本、画布与浏览器 QA 文件及文档 | 可作为未来回归线索，未运行，不能复用为当前版本通过证据 |

工作树已有多处修改与未跟踪文件。本文不覆盖、还原或评价其他代理的改动。功能范围以最新用户“全部保留”指令为准，UI 规范按原文其余有效条款执行；README 中的功能描述只作为基线盘点线索，不能当作当前验收结果。

## 3. P0 验收清单

### P0.1 Global Shell（§1–21、113–118、126–129、133–139）

| 编号 | 可核验标准 | 当前状态 |
| --- | --- | --- |
| V73-P0-01-01 | 所有页面统一 Global App Bar / Left Navigation / Main Workspace / 可选 Right Inspector；保留原有入口与导航能力；默认进入制作表或恢复既有合法视图偏好，四视图切换始终可达 | 待验证 |
| V73-P0-01-02 | Desktop App Bar 44px；左导航 184–200px；Inspector 300–320px；主区 flex；页面标题区 40–48px，显示项目名及镜头数、时长、FPS、画幅，无 Hero | 待验证 |
| V73-P0-01-03 | App Bar 左为菜单、FRAMEFORGE、Breadcrumb，中为 Search，右为 Sync、Comments/Changes、User、更多；不横排所有全局动作 | 待验证 |
| V73-P0-01-04 | 导航以制作、视觉、资源、声音、审阅、项目分组呈现原文入口，同时完整保留现有交付/导出、分享、审批、管理等入口；位置可重设计但需建立旧入口→新入口映射。Active 为中性背景，可用 2px 指示线 | 待验证 |
| V73-P0-01-05 | 页面动作放 Local Toolbar，Shot 新增镜头为主 Primary，其余用 Ghost/Secondary；四视图切换采用统一低噪声控件，无重复 Toolbar；分享、审批及其他动作保留并合理分层，不以收敛视觉为由隐藏能力 | 待验证 |
| V73-P0-01-06 | 滚动条 6px、透明轨道、弱滑块；Loading 使用 Skeleton；Empty 仅标题、一句话、一个动作；检查加载、空态及错误恢复 | 待验证 |
| V73-P0-01-07 | Dock、Popover、Dialog、选择、拖拽、插行、图片预览和 Inspector 编辑动效克制，无卡片普遍悬浮、大 scale、全屏 blur 动画 | 待验证 |
| V73-P0-01-08 | AI 等能力按实际迁移前基线保留：已有功能/入口统一重设计，不因原文 §126 删除；原先关闭或仅有接口的能力如实登记，保留 EntityRef、ObjectRelation、AIProvider 等契约，不虚构可用功能 | 待验证 |

### P0.2 UI Component Library（§22–36）

| 编号 | 可核验标准 | 当前状态 |
| --- | --- | --- |
| V73-P0-02-01 | 产品 UI 从 `packages/ui` 的 `@frameforge/ui` 公共入口导入；React、TypeScript、Tailwind CSS、CSS Variables 有真实构建与使用证据，不能以目录或依赖存在代替 | 待验证 |
| V73-P0-02-02 | 统一采用 Radix UI/shadcn primitives、Motion、TanStack Table/Virtual、dnd-kit、react-resizable-panels、cmdk、Sonner、react-day-picker、react-konva/Konva Transformer、react-hook-form/Zod；按表格、画布、表单等实际用途核对接入 | 待验证 |
| V73-P0-02-03 | Select、Dialog、Popover、Tooltip、Dropdown、Resize Panel、Drag Sort、Virtual Table、Canvas Transform、Toast、Command Palette 不在业务页重复自制；旧页也遵守统一控件入口 | 待验证 |
| V73-P0-02-04 | 少量模式及四视图切换采用统一 SegmentedControl/Tabs；简单单选 Select，多选 MultiSelect，多选项 Combobox，人员 UserPicker，素材 AssetPicker，字段 FieldPicker | 待验证 |
| V73-P0-02-05 | Toolbar Button/Icon Button/Input/Select/Segment 为 30px，Primary Button 为 32px；同 Toolbar 的对齐与高度差须按设计规格核对，无意外混高 | 待验证 |
| V73-P0-02-06 | 英文和数字 Satoshi；中文更纱黑体、PingFang SC、Microsoft YaHei、system-ui 回退；Timecode、Shot、Frames、FPS、Version 使用 tabular-nums，禁等宽字体 | 待验证 |
| V73-P0-02-07 | 字体“字号/行高 字重”：Workspace Title 16/22 600；Section 13/18 600；Body 12.5/18 400；Table 12/16 400；Control 12/16 500；Metadata 11/16 400；Header 11/16 500 | 待验证 |
| V73-P0-02-08 | CSS Variables 与下方色板一致；排除图片视频后的面积比例 Neutral ≥93%、Accent ≤4%、Semantic ≤3%，保存测量口径与结果 | 待验证 |
| V73-P0-02-09 | Glass 仅用于 App Bar、Floating Toolbar、Popover、Dialog、Command Palette、HUD；Table、Canvas、Media、Viewer、Long Text 内容面保持稳定不透明 | 待验证 |
| V73-P0-02-10 | 检查所有业务渲染路径及弹出态，无裸 select、checkbox、radio、可见 file input 或浏览器 alert/confirm/prompt；组件具有正确焦点、Esc 关闭和键盘操作 | 待验证 |

颜色基准（§32）：`--app-bg #101112`、`--sidebar-bg #141517`、`--surface-1 #181A1C`、`--surface-2 #1D1F21`、`--surface-3 #242629`、`--media-bg #090A0B`、`--canvas-bg #0D0F10`；`--text-1 #F2F2F0`、`--text-2 #B9B8B4`、`--text-3 #85847F`、`--text-4 #62615D`；`--border-soft rgba(255,255,255,.055)`、`--border rgba(255,255,255,.085)`；`--focus #648FE8`、`--success #57A778`、`--warning #C29B59`、`--danger #D5666B`。

### P0.3 Shot 四视图与 Table（§2–7、37–51，功能范围按用户覆盖）

| 编号 | 可核验标准 | 当前状态 |
| --- | --- | --- |
| V73-P0-03-01 | Table / Card / Wall / Timeline 四视图全部保留且可切换；统一 Shell、tokens、字体、工具栏、控件与选中态。Table 顶部保留搜索、列、筛选、导入、PDF、新增镜头，各视图原有动作与偏好均可用 | 待验证 |
| V73-P0-03-02 | 默认列按顺序为 Shot、Storyboard、TC、Duration、Title、Scene、Shot Size、Lens、Movement、Angle、Visual、VO、Methods、Status；同一 Shot 数据贯通表格及辅助区 | 待验证 |
| V73-P0-03-03 | 默认行高 42px，Visual/VO 最多两行；选中背景 rgba(100,143,232,.08)，可选左侧 2px 指示线，无整行大蓝选中 | 待验证 |
| V73-P0-03-04 | 双击单元格进入 Input / Autosize TextArea / FRAMEFORGE Select / MultiSelect；不用 contenteditable；Enter 保存、Esc 取消、Tab 保存并到下一格、Shift+Tab 到前一格，保存后刷新一致 | 待验证 |
| V73-P0-03-05 | 列头边缘拖动改变宽度，双击自动适配；Column Manager 为统一 Popover，支持搜索、显示、隐藏、拖动排序及新增自定义字段 | 待验证 |
| V73-P0-03-06 | 自定义字段逐一验证创建、编辑与重载值：文本、长文本、数字、选择、多选、状态、日期、人员、文件/媒体、复选框、网址、关联、Timecode、Frames；不能只验证类型菜单存在 | 待验证 |
| V73-P0-03-07 | 左侧拖动柄重排行，拖动期间有 insertion line；Drop 后 sort_index 更新、Shot Number 更新、TC reflow，重新加载顺序与时间不变 | 待验证 |
| V73-P0-03-08 | Storyboard 空图 hover 提供上传；有图 hover 提供替换、预览、更多；操作完成后关联正确 Shot，取消或失败不产生错误替换 | 待验证 |
| V73-P0-03-09 | Storyboard Strip 位于表格上或下，可折叠，展示缩略图、Shot Number、Duration，点击定位表格行；同时保留独立 Wall 视图及其原有能力，Strip 不替代或移除 Wall | 待验证 |
| V73-P0-03-10 | Card / Wall / Timeline 分别验证既有浏览、选择、编辑、媒体操作、筛选/分组等实际能力；四视图读写同一 Shot，修改字段、时长或重排后切换与重载一致 | 待验证 |

### P0.4 Inspector 与协作/审批（§52–66，功能范围按用户覆盖）

| 编号 | 可核验标准 | 当前状态 |
| --- | --- | --- |
| V73-P0-04-01 | Inspector 300–320px，以 label/value 阅读态为默认；点击 Value 才进入编辑，完成回 Renderer；分区为基础、时间、摄影、内容、制作、版本、自定义，无常驻输入框墙 | 待验证 |
| V73-P0-04-02 | 保留现有制作状态、审批状态、Reviewers、请求审阅及审批链等实际能力与入口；重设计为清晰的 Property/分区/动作层级，不合并或删除业务状态，权限及状态转换保持兼容 | 待验证 |
| V73-P0-04-03 | 内部评论可添加、回复、解决、@成员；切换 Shot 后归属正确并可重载查看 | 待验证 |
| V73-P0-04-04 | 修订支持查看、应用、拒绝及待处理/已应用/已拒绝呈现；保留既有扩展状态与审批能力，文案准确区分建议修改和审批动作；应用更新目标字段，拒绝不误改目标数据 | 待验证 |
| V73-P0-04-05 | 修改记录显示谁、什么时候、改了什么；Global Comments/Changes 展示评论、修订和记录；现有 Inbox/Review Request/Task Queue/Approval Queue 等协作入口按基线保留并统一 UI，不因原文 §65 删除 | 待验证 |

### P0.5 Asset Library（§74–82、135）

| 编号 | 可核验标准 | 当前状态 |
| --- | --- | --- |
| V73-P0-05-01 | 进入即显示媒体 Grid，桌面 4–6 列；卡片含 thumbnail、filename、type、usage；不默认文件表或文件名按钮列表 | 待验证 |
| V73-P0-05-02 | hover 才显示预览、使用、更多；顶部搜索素材与 Filter；左侧全部、图片、视频、音频、场景参考、人物参考、上传，操作结果与筛选一致 | 待验证 |
| V73-P0-05-03 | 可新建手动素材集并拖入素材，重载后归属正确；如基线存在 Dynamic Query/Metadata Collection，完整保留并使用统一筛选与字段组件重设计，不作为禁止功能 | 待验证 |
| V73-P0-05-04 | Inspector 展示文件名、类型、大小、分辨率、FPS、时长、上传人、使用位置、标签、备注；预览和使用实际媒体可用，缺失字段不伪造 | 待验证 |

### P0.6 Import（§83–89）

| 编号 | 可核验标准 | 当前状态 |
| --- | --- | --- |
| V73-P0-06-01 | Desktop Wizard 宽 min(1100px, viewport - 64px)；只有选择文件、字段映射、数据预览、导入四步，无 500px 小框 | 待验证 |
| V73-P0-06-02 | 映射为来源列/示例/目标字段三栏，目标字段用 Combobox；验证搜索、选择、返回上一步、预览与最终映射一致 | 待验证 |
| V73-P0-06-03 | 解析、校验、写入、完成来自真实任务状态；含有效、跳过及无效行的测试导入显示真实成功/跳过/失败统计，写入结果与统计相符 | 待验证 |
| V73-P0-06-04 | 对当前支持的 xlsx/csv/tsv 路径回归，保留字段值与 Shot 归属；错误可定位并恢复，不能以假进度、定时完成或空预览宣称可用 | 待验证 |

### P0.7 Review（§67–73、134）

| 编号 | 可核验标准 | 当前状态 |
| --- | --- | --- |
| V73-P0-07-01 | 媒体、评论、版本及 Compare 是 Review 主要内容；保留现有 Request Review、Assign Reviewer、Approve、撤回、驳回等实际流程与入口，以统一控件重设计；不绕过既有权限、状态或审批前置条件 | 待验证 |
| V73-P0-07-02 | 左 Strip 200–220px，中心 Viewer flex 且最大面积、黑色背景，右 Comments 300–320px；1440 与 1920 宽度下媒体仍为主 | 待验证 |
| V73-P0-07-03 | 普通评论、时间点评论、区域评论、标注实际可用；关联正确 Shot/版本，重载后可准确定位 | 待验证 |
| V73-P0-07-04 | 同一 Shot 的 V1/V2/V3 可选择；P0 Side by side 确实展示两份所选版本，版本切换、空版本、媒体加载异常有明确表现 | 待验证 |

### P0.8 PDF（§90–92）

| 编号 | 可核验标准 | 当前状态 |
| --- | --- | --- |
| V73-P0-08-01 | PDF Modal 居中、宽 560–620px，三种视觉选项为分镜表、九宫格、单镜详细 | 待验证 |
| V73-P0-08-02 | 导出前执行 image preload、decode、preflight；失败指出具体 Shot；分别检查三种实际输出中的图片、文字及镜头对应关系，不能只看预览窗口 | 待验证 |

### P0.9 Search（§10、38、46、78、128、140）

| 编号 | 可核验标准 | 当前状态 |
| --- | --- | --- |
| V73-P0-09-01 | 集中的全局 Search 可输入、返回相关结果并定位实际对象；当前表搜索作用于当前表，素材搜索作用于素材，列搜索作用于字段，各入口范围清楚 | 待验证 |
| V73-P0-09-02 | 验证中文、英文、数字、无结果与清空恢复；搜索不丢失编辑值、选中对象或跳到错误视图；四视图中的定位与恢复保持一致；Command Palette 如使用则来自 cmdk 与统一 UI | 待验证 |

### P0.10 Production Method / Steps（§93–98）

| 编号 | 可核验标准 | 当前状态 |
| --- | --- | --- |
| V73-P0-10-01 | 制作方式用 MultiSelect，含实拍、素材、客户素材、档案、静帧、AE、MG、3D、VFX、字幕；增减后保存与重载一致，“客户素材”仅为来源类型 | 待验证 |
| V73-P0-10-02 | 步骤以步骤/状态/负责人简洁行呈现；新增、删除、重命名、重排、负责人、状态逐项可编辑并持久化；现有审核/批准/请求检查能力保留，按统一动作层级重设计 | 待验证 |

### P0.11 Timing（§7、99–101）

| 编号 | 可核验标准 | 当前状态 |
| --- | --- | --- |
| V73-P0-11-01 | 旁白与时间为独立页面，逐句行展示 Shot 编号、标题、时长、旁白文本；Timeline 视图同时保留并统一视觉，两者时间数据一致 | 待验证 |
| V73-P0-11-02 | 修改一句只重算该句/当前 Shot；对比操作前后数据验证其他句与其他 Shot 的内容、时长未被全篇重算；必要的后续 TC 顺延与局部时长重算分开核验 | 待验证 |

### P0.12 Performance（§3、112–118、128、140）

| 编号 | 可核验标准 | 当前状态 |
| --- | --- | --- |
| V73-P0-12-01 | 记录硬件、OS、浏览器/Electron 版本、视口、缩放、媒体大小和数据规模；测冷/热启动、表格滚动、搜索、编辑保存、拖拽、图片预览、导入与 PDF 耗时、长任务和内存 | 待验证 |
| V73-P0-12-02 | 长表使用 TanStack Virtual；验证虚拟化下编辑、选择、Strip 定位、列宽和重排仍正确，无重复事件或明显卡顿；大图/媒体加载与 Skeleton 不阻断主要操作 | 待验证 |
| V73-P0-12-03 | 在验收执行前登记量化预算及依据，随后提供实际结果。需求未指定镜头量、FPS、毫秒或内存门槛；缺预算/实测不得自行声称“性能达标” | 待验证 |

### P0.13 全部现有功能与入口保留（最新用户覆盖）

此清单补充原文，并非允许只保留下列示例。正式验收须从迁移前的页面、菜单、上下文菜单、快捷键、链接、保存偏好和权限状态建立完整基线，逐一映射新 UI。基线发现的每项能力都纳入回归；原本未实现的功能记录事实，不当作已存在或已验收。

| 编号 | 可核验标准 | 当前状态 |
| --- | --- | --- |
| V73-P0-13-01 | 建立完整能力/入口台账：旧入口、业务动作、权限、数据契约、原状态、对应新入口、操作证据；入口可重排但功能不可删除、隐藏、置空或仅留不可用占位 | 待验证 |
| V73-P0-13-02 | Table/Card/Wall/Timeline 及其他既有页面保留；Saved Views、模式、列偏好、筛选/分组、选择和快捷键按真实基线回归，四视图切换不丢失未保存编辑或媒体引用 | 待验证 |
| V73-P0-13-03 | 分享/Snapshot 相关既有入口与能力保留并重设计：查看、复制链接、密码、下载策略、ZIP、撤销、过期及只读访问按实际基线逐项验证；权限与令牌语义不因 UI 迁移改变 | 待验证 |
| V73-P0-13-04 | 审批/审阅请求相关既有入口与能力保留并重设计：提交、撤回、同意、驳回、审批人、状态链、客户确认等以实际基线为准；操作者、版本关联、审计记录和权限校验不退化 | 待验证 |
| V73-P0-13-05 | 项目创建/设置、账号申请/审批、用户管理、项目快照、备份/恢复等现有管理入口保留，使用统一表单、提示和确认组件，不能以“简化工作流”为由省略业务校验 | 待验证 |
| V73-P0-13-06 | 保留现有导入、上传、媒体替换、Panel、批量编辑、剪贴板、撤销重做和交付导出能力；PDF、CSV、JSON、SRT、VTT、OTIO、EDL、FCPXML 等已支持格式逐项盘点并回归，不因本表只重点列 PDF 而缩减 | 待验证 |
| V73-P0-13-07 | 保留自动保存、草稿、同步状态、冲突处理、变更历史及跨页面数据一致性；数据失败/恢复路径和必要确认步骤同样迁移为统一 UI | 待验证 |
| V73-P0-13-08 | 素材集/查询、协作中心、画布模式、制作步骤审批、AI 接口或 UI 等按实际基线保留；不得套用原文“不做/删除”列表关闭现有功能，也不得把尚未实现的候选项虚构为存在 | 待验证 |

## 4. P1 验收清单

| 编号 | 可核验标准 | 当前状态 |
| --- | --- | --- |
| V73-P1-01-01 | Moodboard 为 Left Asset Tray / Center Canvas / Right Inspector，支持拖图、排版、整理视觉；图片、色彩、字体对象及现有模式/入口均保留，模式控件统一重设计（§106–109、136，功能范围按覆盖） | 待验证 |
| V73-P1-01-02 | Moodboard 浮动工具栏包含 Pointer、Hand、Frame、Text、Image、Note、Comment；其余既有工具保留并合理分层；实际对象添加与属性编辑可用（§108，功能范围按覆盖） | 待验证 |
| V73-P1-02-01 | Scene Plan 在统一 Canvas 组织平面、摄影、灯光，采用 Left Layers/Object Library / Center Canvas / Right Inspector；既有平面/摄影/灯光 Tabs 或模式入口保留并统一视觉（§102–105、137，功能范围按覆盖） | 待验证 |
| V73-P1-02-02 | 场景、人物、摄影机、灯光、Grip、Reference 支持图层显示开关；工具栏包含 Pointer、Hand、Object、Measure、Comment，保留其他既有工具；摆机位与布灯可操作（§104、108，功能范围按覆盖） | 待验证 |
| V73-P1-03-01 | 两个画布分别核验背景 #0D0F10、弱 Grid、选中 1px focus outline 与 handles；pan、zoom、select、multi-select、drag、resize、rotate、snap、group、lock、hide、undo、redo 全部可用（§110–112） | 待验证 |
| V73-P1-03-02 | 两个画布使用 react-konva/Konva Transformer，通过统一 UI 提供图层、Inspector 和工具栏；选择/变换/撤销结果一致，既有模式切换不丢失对象或状态（§20、22–24、139–140，功能范围按覆盖） | 待验证 |
| V73-P1-04-01 | Review 的 Wipe 与 Overlay 均实际比较所选版本；调节、切换和退出后版本归属与评论上下文正确（§73） | 待验证 |
| V73-P1-05-01 | Electron 同时验证 macOS hiddenInset/vibrancy 与 Windows Mica/titleBarOverlay；Web 有 CSS Glass fallback；材料支持情况与回退需记录实机证据（§119–123） | 待验证 |
| V73-P1-05-02 | Web/Electron 100% 共用产品组件；Electron 增量仅 File Dialog、Save Dialog、System Notification、Deep Link、Update、Cache 等平台能力，入口与窗口行为实际可用（§124–125） | 待验证 |

## 5. 指定截图矩阵（§130）

以下 13 项全部必需；当前未采集。需求仅指定宽度或弹窗状态，未指定高度。建议 Desktop 1920×1080 / 1440×900、Mobile 375×812，弹窗采用 1440×900；这些高度是记录建议，不冒充用户硬性要求。每张应记录 CSS viewport、DPR、OS、构建、页面/对象、状态和证据文件。P1 页面截图不能从矩阵删掉。

原文 13 项保留；为覆盖最新用户要求，追加 SS-14–21 的四视图与分享/审批证据，不用它们替换原矩阵。

| 编号 | 必需截图 | 拍摄状态与重点 | 当前状态 |
| --- | --- | --- | --- |
| V73-SS-01 | 1920 Shot Table | 有图与长文本的制作表、唯一 Primary、默认列、阅读态 Inspector | 待验证 |
| V73-SS-02 | 1440 Shot Table | 窄桌面表格、选中行、工具栏对齐、内容面积与滚动边界 | 待验证 |
| V73-SS-03 | 1920 Asset Library | 4–6 列媒体 Grid、搜索/筛选、元数据 | 待验证 |
| V73-SS-04 | 1440 Asset Library | 网格适配、单卡 hover actions、Inspector | 待验证 |
| V73-SS-05 | 1920 Review | 最大黑色 Viewer、左右 Strip/Comments、实际版本媒体 | 待验证 |
| V73-SS-06 | 1440 Review | Side by side、版本与评论区仍可使用 | 待验证 |
| V73-SS-07 | 1920 Moodboard | Asset Tray、多个对象、选中 handles、Inspector、浮动工具栏 | 待验证 |
| V73-SS-08 | 1920 Scene Plan | 同一画布的场景/摄影机/灯光、图层开关、对象选中 | 待验证 |
| V73-SS-09 | Import Mapping | 大型四步 Wizard 的映射步、三栏、目标 Combobox | 待验证 |
| V73-SS-10 | PDF Modal | 居中 560–620px、三种视觉选项 | 待验证 |
| V73-SS-11 | Select Open | 真实统一 Select 展开态、选中/焦点/弹层，不是关闭态截图 | 待验证 |
| V73-SS-12 | MultiSelect Open | 真实多选展开态及多个选项状态，建议制作方式 | 待验证 |
| V73-SS-13 | 375 Mobile | 宽 375px 的实际项目工作区、导航/Inspector 收纳和主要动作可达，无页面级溢出遮挡；必要时补充展开态 | 待验证 |
| V73-SS-14 | 1920 Shot Card | 卡片视图重设计、媒体/字段/动作保留，切换控件与 Table 同风格 | 待验证 |
| V73-SS-15 | 1440 Shot Card | 窄桌面卡片布局、操作可达、选中态与文字密度 | 待验证 |
| V73-SS-16 | 1920 Shot Wall | 视觉墙重设计、媒体主导、既有动作与入口保留 | 待验证 |
| V73-SS-17 | 1440 Shot Wall | 墙面适配、预览与选择、无视觉溢出或重复工具栏 | 待验证 |
| V73-SS-18 | 1920 Shot Timeline | 时间线重设计、时间信息与既有分组/交互入口 | 待验证 |
| V73-SS-19 | 1440 Shot Timeline | 时间轴/轨道或既有时间布局可读，操作不被遮挡 | 待验证 |
| V73-SS-20 | 分享入口与设置/访问页 | 建议 1440 宽；保留原有能力，打开真实分享设置并补充访问页，统一控件与视觉 | 待验证 |
| V73-SS-21 | 审批/审阅请求入口与展开态 | 建议 1440 宽；保留真实动作、状态和权限提示，展示重设计后的控件与信息层级 | 待验证 |

每张截图均逐项回答以下问题（§131），每题当前状态均为“待验证”；不适用须附原因，不能默认为通过：

| 编号 | 逐图复核问题 | 当前状态 |
| --- | --- | --- |
| V73-SS-Q01 | 第一眼是内容还是控件？ | 待验证 |
| V73-SS-Q02 | 四视图及既有模式 Tabs 是否保留并统一风格？是否存在重复绘制、无用途的视觉冗余（不能把功能切换本身认定为冗余）？ | 待验证 |
| V73-SS-Q03 | 有没有重复 Toolbar？ | 待验证 |
| V73-SS-Q04 | 有没有裸 Select？ | 待验证 |
| V73-SS-Q05 | 按钮高度一致并符合 30/32px 规格吗？ | 待验证 |
| V73-SS-Q06 | Inspector 像 Property 还是 Form？ | 待验证 |
| V73-SS-Q07 | 蓝色是不是太多？ | 待验证 |
| V73-SS-Q08 | Border 是否太多？ | 待验证 |
| V73-SS-Q09 | 内容区域是否够大？ | 待验证 |
| V73-SS-Q10 | 媒体是不是主要色彩来源？ | 待验证 |

截图只能证明对应静态状态；四视图、分享、审批、其他既有业务、Inline Edit、Column Resize、Custom Fields、Reorder、Search、Import、Comments、Compare、PDF 图片、Methods/Steps、Timing、Canvas 和性能仍须操作记录、结果文件或相应测试证据。平台一致性须补充 Web、Windows Electron、macOS Electron 证据。

## 6. 禁止项与 Release Blocker

按最新用户覆盖，本节只列 UI 呈现问题，不禁止任何既有业务能力。原 §132 的 View Switcher 禁令和原 §129 等功能禁令已撤销；保留编号用于追踪修订。以下 UI 问题命中即 FAIL，当前全部待验证，不能将未执行检查写成“未发现”。

| 编号 | 禁止项 / 检查范围 | 当前状态 |
| --- | --- | --- |
| V73-BAN-01 | Native Select：Windows/Chrome 裸下拉，包含导入映射、PDF、Inspector、列管理等弹层 | 待验证 |
| V73-BAN-02 | Native File Picker：产品 UI 暴露原生文件选择控件/可见 file input；平台文件对话框边界见下文 | 待验证 |
| V73-BAN-03 | Browser Alert，以及 alert()/confirm()/prompt() | 待验证 |
| V73-BAN-04 | 原 View Switcher 禁令已撤销。当前仅禁止切换控件未样式化、重复绘制或字体颜色不一致；Table/Card/Wall/Timeline 及既有模式均须保留 | 待验证 |
| V73-BAN-05 | Multiple Primary Buttons：同工作区/工具栏出现多个竞争的 Primary | 待验证 |
| V73-BAN-06 | Big Blue Selection：大蓝色选中行/选中块 | 待验证 |
| V73-BAN-07 | Permanent Input Inspector：Inspector 默认常驻输入表单墙 | 待验证 |
| V73-BAN-08 | Buttons Different Height：不符合统一控件高度、错位或意外混高 | 待验证 |
| V73-BAN-09 | Nested Cards：以层层嵌套卡片组织工作区 | 待验证 |
| V73-BAN-10 | Yellow Navigation：黄色导航 Active | 待验证 |
| V73-BAN-11 | Heavy Status Pills：厚重、高饱和状态胶囊，尤其大绿 Status | 待验证 |
| V73-BAN-12 | UI 规范综合复核：禁止同一产品各页面/弹层控件、色彩、字号或间距不一致；不能靠隐藏入口规避检查 | 待验证 |
| V73-BAN-13 | 裸 checkbox/radio、业务页自制 Select/Dialog/Popover/Tooltip/Dropdown/拖拽/虚拟表格/画布变换/Toast/Command Palette | 待验证 |
| V73-BAN-14 | 原审批/审阅流程禁令已撤销。当前仅禁止审批、审阅请求、分享等页面中的裸控件、过重状态色和冗余视觉；原有能力与入口保留并重设计 | 待验证 |
| V73-BAN-15 | 原修订/Steps 审批与协作入口禁令已撤销。当前仅禁止这些界面的字号、按钮规格、间距与其他页面不一致；保留实际业务动作、状态和文案语义 | 待验证 |
| V73-BAN-16 | 原 AI 功能禁令已撤销。当前仅禁止相关既有 UI 的未样式化控件、抢占内容的冗余装饰和视觉不一致；按实际基线保留能力与启用状态 | 待验证 |
| V73-BAN-17 | 原独立视图、画布模式、动态素材集禁令已撤销。当前仅禁止其视觉风格分叉、重复工具栏或颜色字号不一致；既有能力与入口均保留 | 待验证 |
| V73-BAN-18 | 黄色 Shot、青色 Method、大绿 Status、大蓝 Selected Row；Timecode/Shot/Frames/FPS/Version 等宽字体 | 待验证 |
| V73-BAN-19 | Table/Canvas/Media/Viewer/Long Text 使用 Glass；每卡 hover 上浮、大 scale、全屏 blur；巨型 Hero 和顶部横排所有全局功能 | 待验证 |

边界解释：禁止的是产品界面中的未样式化文件控件，不是文件选择、上传或保存能力。统一上传/保存组件调用系统文件对话框可保留；隐藏 file input 是实现细节。审批、分享、账号管理、权限校验与历史记录均保留。原生 alert/confirm/prompt 的提示或确认业务语义须通过统一 Dialog 等组件继续提供，不能直接删掉确认步骤。

高度边界：§28 同时规定普通工具栏控件 30px、Primary 32px与工具栏必须齐。按各控件规定高度及对齐验收；明确指定的 32px Primary 不直接当作意外混高，其余偏差需记录证据。

## 7. vanilla JS → React/TS `packages/ui` 渐进迁移风险

下表是需由主代理实现、后续验收核对的风险与关口，不代表本次已改代码或完成迁移。

| 编号 | 风险与依据 | 验收关口 | 当前状态 |
| --- | --- | --- | --- |
| V73-MIG-01 | 当前 esbuild 仅打包 Material Web；新增 packages/ui 可能只形成空目录或未被业务引用 | 从实际产品入口追踪 React/TS 构建、模块解析、公共 exports 和运行产物；每个产品页面使用统一组件库 | 待验证 |
| V73-MIG-02 | `innerHTML`/传统全局事件与 React 同时操作同一 DOM，可导致输入丢失、重复提交、卸载后监听泄漏 | 明确各挂载区域所有权及 adapter 生命周期；反复进入退出、编辑、开关弹层后无重复行为，旧脚本不覆写 React 根 | 待验证 |
| V73-MIG-03 | 旧 state/localStorage 与 React state 双份存储会让排序、列偏好、选中 Shot 和 TC 分叉 | 同一 Shot 标识及数据源贯通表格、Strip、Inspector、Review、PDF；刷新、切页、保存失败/重试后的结果一致 | 待验证 |
| V73-MIG-04 | 多份全局 CSS、Material Web 样式与 Tailwind/tokens 并存，易出现字体、控件高度、阴影、焦点和层级冲突 | 覆盖旧页、新页、Portal 弹层与移动端截图；检查 computed style、焦点恢复、滚动锁和遮挡 | 待验证 |
| V73-MIG-05 | 按原文移除 view tabs/审批/分享会违反最新用户指令，并破坏偏好、路由、命令入口与业务状态 | 四视图、分享、审批及全部既有入口逐一映射到新 UI；旧链接与偏好兼容，保留状态转换、权限及历史记录，不以隐藏或删除能力完成迁移 | 待验证 |
| V73-MIG-06 | UI 字段类型、序列化、媒体引用与 Python API 契约不兼容可损坏既有业务数据 | 以隔离样本验证读取、编辑、保存、重载、导入与导出，覆盖自定义字段、版本、Steps、Timing 和媒体；本次文档工作不执行这些写操作 | 待验证 |
| V73-MIG-07 | TanStack Table/Virtual 与 dnd-kit 集成会改变行索引、可见 DOM、编辑焦点与测量逻辑 | 在过滤、滚动、重排与 Strip 定位时始终按稳定 Shot 标识操作；核验 sort_index、编号、TC 与持久化 | 待验证 |
| V73-MIG-08 | 老画布与 react-konva 同时管理坐标、选择与 undo 栈，会破坏缩放、拖拽、旋转和多选 | 两个画布各自验证完整交互、图层、既有模式及撤销重做；保留对象关系、入口和数据读取兼容 | 待验证 |
| V73-MIG-09 | Web 与 Electron 分叉实现或继续依赖远程 UI/font 资源，会破坏组件一致和现有内网使用方式 | 产品组件共享，平台桥仅承担系统能力；验证静态部署资源路径、字体/依赖可达与平台回退；构建脚本成功不能替代实机检查 | 待验证 |
| V73-MIG-10 | 旧 QA 绑定 Material DOM；若按原文取消四视图/审批测试，会漏掉最新要求的功能回归 | 重映射旧测试到本文稳定编号；保留业务路径断言并更新 UI 定位与样式断言，补齐分享/审批/四视图回归；所有结论绑定当前构建 | 待验证 |
| V73-MIG-11 | 并行修改期间结构快照过期，或迁移只覆盖 P0，造成将局部完成误称 V7.3 PASS | 收口时重新审查入口、组件导入和遗留脚本；核对 P0/P1、全功能台账、原 13 项及追加截图、UI 禁项和性能证据，使用最新用户覆盖后的口径 | 待验证 |

## 8. 证据登记与交接

| 项目 | 当前值 |
| --- | --- |
| 最终构建/提交标识 | 待验证 |
| P0 功能与静态规范 | 待验证 |
| P1 画布、Compare 扩展与 Electron | 待验证 |
| 原 13 项及追加 8 项截图、每图 10 问 | 待验证 |
| 全部现有能力与入口保留台账、分享/审批/四视图回归 | 待验证 |
| Release Blocker / 其他禁止项扫描与可达路径复核 | 待验证 |
| 迁移兼容与性能预算/实测 | 待验证 |
| V7.3 最终结论 | 待验证 |

单项证据记录格式：`编号 | 构建 | 环境/数据规模 | 操作与预期 | 实际结果 | 截图/录像/日志/输出文件路径 | 执行时间/验收人 | 状态`。发生失败时关联缺陷记录与复验结果，不删除原始失败证据。

本次交付仅为验收文档；未运行浏览器、未启动服务、未修改数据库、未变更业务代码，也未将任何验收项标为完成。
