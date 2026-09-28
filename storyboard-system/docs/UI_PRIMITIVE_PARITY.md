# UI primitive parity ledger

2026-09-29，基于 `0826adf` 后的第二批 Select 切片。旧 owner 是 `storyboard-system/packages/ui`（由旧工作区 tsconfig alias 解析）；新 owner 是仓库根 `packages/ui`。消费者数量指**直接导入该控件的 TSX 模块数**，不是渲染次数；V = `apps/web`，L = `storyboard-system/src/workspace`。本表只证明逐项迁移进度，不能替代真实运行入口切换。

| Primitive | Old owner / L 消费数 | New owner / V 消费数 | API compatibility | Visual compatibility | Focus behavior | Accessibility | Tests / evidence | Cutover |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Button | Legacy / 4 | root / 1（登录） | `variant`、button props、默认 type 对齐；shadcn 新 variant 待定义 | Legacy 尺寸、间距、hover/active 已移入根 CSS；全站 parity 未证 | 根包有 focus-visible | 原生按钮、disabled | V-Web build；登录 320/375/1440 浏览器 | INTEGRATED_NOT_CUT_OVER |
| IconButton + Tooltip | Legacy / 3 | root / 0 | `label`、按钮 props；根包 Radix tooltip | 根包 tooltip 基础样式已入，未比较旧工作区截图 | Radix 触发与关闭待浏览器验证 | aria-label + tooltip | 根 UI build；无 V 消费场景 | IMPLEMENTED_NOT_INTEGRATED |
| Input | Legacy / 3 | root / 1（登录） | HTML input props/ref 对齐 | 根包边框、填充、禁用、错误、placeholder；登录实测 | 登录 focus-visible 可见 | Field 标签关联 | V-Web build；登录 320/375/1440 浏览器 | INTEGRATED_NOT_CUT_OVER |
| TextArea | Legacy / 1 | root / 0 | HTML textarea props/ref 对齐 | 根包基础样式；未比较真实视图 | focus-visible 代码已入 | 原生 textarea | 根 UI build；无 V 消费场景 | IMPLEMENTED_NOT_INTEGRATED |
| Field | Legacy / 3 | root / 1（登录） | `label`/children 对齐 | 根包 grid 与 6px gap；登录实测 | 标签点击进入控件 | label 包裹控件 | 登录表单浏览器 | INTEGRATED_NOT_CUT_OVER |
| Select | Legacy / 1 | root / 1（登录角色） | 旧 `label/value/options/onChange/disabled`；新增 name/required/className | 根包菜单、选项与 trigger 基础样式；跨主题待核 | Radix 键盘选择、Escape 返回焦点 | combobox、option、disabled | UI/Web build；320×568 翻转、320/375/1440 点击命中与键盘选项 | INTEGRATED_NOT_CUT_OVER |
| Checkbox | Legacy / 1 | root / 0 | 待迁 | 待迁 | 待迁 | 待迁 | 无根包验证 | BLOCKED（root 未迁） |
| Popover / Menu / Modal | Legacy / 2 / 1 / 0 | root / 0 | 控制状态、关闭、对齐待迁 | collision/portal/层级待迁 | Escape/外点/焦点返回待迁 | dialog/menu 语义待迁 | 旧工作区用例不能证明根包 | BLOCKED（root 未迁） |
| Icons / Motion | Legacy 多处 | root / 0 | 单一图标与 motion token 待迁 | 动效/主题待迁 | 状态结束焦点待核 | 状态语义待核 | 无根包验证 | BLOCKED（root 未迁） |

删除 Legacy 同名包前，必须完成根包 primitive parity，旧工作区改为消费根包，并让 `storyboard-system npm run check` 与 `apps/web build`、实际浏览器焦点和视觉测试同时通过。未达到门槛前两个 source tree 保留，禁止宣称 `CUT_OVER`。
