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
