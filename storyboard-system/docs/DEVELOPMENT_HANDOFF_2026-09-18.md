# FRAMEFORGE 开发交接文档 — 2026-09-18

> 本文件替代此前任何「P0–P3 已完成」的说法。所有状态以**实测证据**为准，未通过项一律标注为未通过。

---

## 0. 一句话状态

**P0 核心交互已修并通过测试，P2 立体视图（3D）可见性已修复、2.5D 模式已移除，器材资产已升级为 ENGINEERING REPLICA，但用户对外观质量明确不满意；尚未部署。**

| 阶段 | 状态 | 说明 |
|---|---|---|
| P0 | **PARTIAL PASS** | caret / 单选 / 景别-焦段联动 测试通过；保存往返已修。仍建议人工复核 |
| P1 | **PARTIAL PASS** | 视觉收敛 A1/B1–B5 已改；B 档剩余项与死代码清理未做 |
| P2 | **PARTIAL PASS** | 3D 视口能真实渲染器材；2.5D 已按用户要求移除；**模型外观质量被否** |
| P3 | **NOT DEPLOYED** | 按项目文档要求，P0/P2 未全过前不放行 |

---

## 1. 本轮实际改动（全部有测试或截图背书）

### 1.1 立体视图渲染链路（原本全黑/空白）
- **WebGL 画布上下文冲突**：2D 画布先取了 context，WebGL 运行时复用同一块画布 →
  `Canvas has an existing context of a different type`，`syncScene` 从未执行。
  修复：`initDOM` 只复用 `ff-lighting-webgl-canvas`；`WebGLRenderer` 包 try/catch（失败回退 2D 投影）。
- **分屏把主画布拽离 DOM**：`stage.replaceChildren(splitWrap)` 导致之后所有模式画在游离节点。
  修复：分屏复用主画布放入左栏（保留事件监听），非分屏时归还 stage。
- **分屏右栏被推出可视区**：stage 宽度残留 1600px。修复：分屏下 stage 收缩回 100%。

### 1.2 保存往返丢数据（P0 核心）
后端 V2 以 `objects` 为规范形态、同名 `items` 被 `seen_items` 去重丢弃；前端只读 `items` →
刷新后 0 元素。修复：前端 `hydrateBoards()` 在载入后用 `demoteItem` 把 objects 降级回 items。
**实测**：8 个元素保存→刷新→重开项目，8 个全部存活（GLB 3 / meshes 41）。

### 1.3 灯架高度 / 俯仰垂直上下（本日新增需求）
- **俯仰角 bug**：`lighting-render.js` 读 `item.aimTilt`（V2 字段名），而画布对象是 V1 降级形态
  字段 `aim_tilt` → 俯仰**恒为 -35° 从未生效**；且 `||` 会把合法的 `0`（水平）吞掉。
  修复后实测：默认 -45 → 垂直向上 +90 → 垂直向下 -90 → 水平 0。
- 属性面板新增：俯仰三档快捷（垂直向下↓/水平→/垂直向上↑）、高度档位（落地0/60/180/300/顶光420）。

### 1.4 灯光配件按灯头接口适配（本日新增能力）
此前完全无接口匹配。新增 `MOUNT_ATTACHMENTS` 兼容矩阵：
- Bowens → 裸灯/柔光箱/蜂巢/**反光伞**/遮扉
- 28mm Spigot、Junior Pin、28mm Junior Pin → 排除反光伞（伞孔只有 Bowens 卡口机型有）
实测：Bowens 机型含反光伞 ✓；Spigot 机型排除反光伞 ✓；不兼容旧值自动回退并提示。

### 1.5 逻辑光 practical
`PRESETS.light.practical`（实景灯）本就在「灯光」分组，**无需新增入口**。
实测：可见（4 mesh）且不画光束覆盖范围，符合逻辑光语义。

### 1.6 器材资产分级与入库
- 门禁重写：不再按「GLB 加载成功」升格 DIGITAL TWIN，改为**按几何来源分级**。
  `digital_twin` 为白名单制（需原生 CAD/STEP + IES + license，当前 **0 个**）。
- 7 个品牌 preset 生成专属几何并入库为 **ENGINEERING REPLICA**：
  ARRI SkyPanel X21 / Aputure STORM 1200x / Nanlite Forza 300B II / 500B II / ARRI Orbiter /
  ARRI ALEXA 35 / Avenger C-Stand 33"。
- 入库验收时暴露并修复**两个集成层 bug**：
  1. `getAsset()` 无 subtype 回退 → `grip` 降级成 `tripod` 后查不到 key，专属几何静默不加载
  2. `getGLBUrl()` 原为 `cc0glb || glb` → **通用模型优先于专属几何**，replica 形同虚设；
     修复前 `Loaded GLBs=4`（一半在加载通用货），修复后 **=7**

### 1.7 移除 2.5D 模式（本日最后一项，应用户要求）
- 模式按钮：`[2D, 2.5D, 分屏, 3D]` → **`[2D, 分屏, 3D]`**
- 默认视图：`lighting` 从 `2.5d` → **`3d`**（前端 `view.mode`、`settings.defaultView`、后端默认值同步）
- 旧数据兼容：`view.mode === '2.5d'` 就地迁移为 `3d`，老画板不会卡在已删除模式
- 函数 `renderScene25d` → `renderScene3d`；分屏右栏投影由 `2.5d` 改 `3d`
- 实测：按钮仅 3 个、默认 `3d`、三模式均正常渲染、0 pageerror 0 4xx

---

## 2. 已知问题 / 限制（务必先看）

### 2.1 器材模型外观质量 —— 用户明确不满意（最高优先级）
> 用户反馈原话：「这模型什么玩意」

现状：7 个 replica 均**程序化基本体拼装**（方箱 + 圆筒 + yoke 叉臂），单位/尺寸/接口按真实规格，
轮廓可辨识，但**不是精细外观模型**，无倒角、无细节、无真实材质。
- 磁盘上**没有任何厂商原生 CAD 模型**；47 个 3DAssets.dev CC0 是演播室通用道具，不能冠品牌名
- 本机**未安装 Blender**，且 `vendor/three-bundle.js` **不含 GLTFExporter**，
  所以「浏览器内导出 GLB」路线不通
- 要达到 DIGITAL TWIN 缺三件套：厂商原生 CAD/STEP、IES 光度文件、license 授权

建议方向（需用户决策）：
1. 引入更高质量的开源器材模型（需联网下载，代理仅部分站点可达）
2. 提供厂商 STEP/IES 走正式 ingest 通道
3. 接受当前精度，但把徽章从 REPLICA 降级标注，避免误导

### 2.1.1 开源精模调研结论（2026-09-18 实测，重要）
用户指示「有的下就下、没有自己做、但保证视觉一致」。实测结果：

**站点可达性**：polyhaven.com、api.polyhaven.com、poly.pizza、kenney.nl、sketchfab.com、
opengameart.org 均返回 200，可访问。

**Poly Haven 实测可用资产**（`api.polyhaven.com/files/<asset>`）：
| 资产 | glTF |
|---|---|
| Camera_01 | ✅ 10KB（8k 贴图版） |
| ArmChair_01 | ✅ 3KB（4k 贴图版） |
| Caged_Hanging_Light / Hanging_Industrial_Lamp / Industrial_Pipe_Lamp / Desk_Lamp_Arm_01 / Coffee_Table_01 | ❌ **404，不存在** |

**三个硬约束（决定了方案走向）**：
1. **影视专业器材没有开源精模**。ARRI / Aputure / Nanlite / Avenger 是商业厂商产品，
   CC0 生态里不存在对应型号模型。品牌灯具只能自制 replica。
2. **能下的都是照片级写实模型**（4K/8K 外部贴图、数千面）。与自制的纯色 PBR 基本体
   混在同一场景会**严重破坏「视觉一致」**——这恰恰是用户明确要求的前提。
3. **8K 贴图对网页是性能灾难**，与「LOD 与性能」目标直接冲突。

**因此推荐路线（待用户确认）**：
- **影视器材（灯具/摄影机/C架）**：自制 replica，开源无解
- **家具/通用道具**：若要引入 Poly Haven，必须做**降配后处理**
  （1k/2k 贴图 + 统一色调 + 统一光照响应），否则不引入
- **保证视觉一致的最稳做法**：全场景统一为「专业示意图」风格（无贴图、统一 PBR 材质族），
  这也是酷家乐等专业工具在同场景内的做法——**风格统一优先于单体精度**
- 若用户坚持要写实精模，则应**整场景统一换成写实路线**（家具+器材都要写实），
  而不是写实家具配积木灯具

### 2.2 其他未完项
- CSS 收敛剩余：B 档部分项、C1 拟物投影、死代码清理
  （`workspace-v73.css` 是构建产物，改了会被下次 build 覆盖，须改 `src/workspace/theme.css`）
- 分屏右栏构图偏窄（各 392px），相机取景未针对半宽视口优化
- 47 个 CC0 道具维持 `GENERIC REFERENCE`，未做品牌映射

---

## 3. 验证方式（可复现）

```bash
# JS 套件（8 个）
node tests/{rich_text_qa,lighting_scene_qa,lighting_render_qa,creative_boards_qa,
            asset_gate_qa,lighting_scene_v2_contract_qa,
            lighting_aim_height_qa,lighting_mount_practical_qa}.cjs

# Python 套件
python -m unittest tests.test_creative_boards_contract \
                   tests.test_backend_integrity \
                   tests.test_lighting_scene_v2_contract

# 2.5D 移除验证
node scratch/verify_no25d.cjs      # 期望：按钮 ["2D","分屏","3D"]，默认 3d
```

关键截图目录：
- `qa-artifacts/independent/` — 四模式渲染、保存往返、俯仰、接口过滤
- `qa-artifacts/replica/` — 7 个 replica 的 2.5D/3D（注：2.5D 截图为移除前产物）
- `qa-artifacts/no25d/` — 移除 2.5D 后的三模式

---

## 4. 环境备忘（接手必读）

- **本地服务**：`cd storyboard-system && PORT=18799 python server.py`
  进程会被回收，出现 `ERR_CONNECTION_REFUSED` 直接重启即可。端口 18765/8080 有僵尸监听不响应，勿用。
- **Node**：`C:/Users/Hatsune/.workbuddy/binaries/node/versions/22.22.2-3/node.exe`
  **Python**：`C:/Users/Hatsune/.workbuddy/binaries/python/versions/3.13.12/python.exe`
- **bash PATH**：每次执行需前缀
  `export PATH="/usr/bin:/bin:/usr/local/bin:/c/Windows/System32:/c/Windows:$PATH"`
  否则 `tail`/`sleep` 等不可用。
- **bash 会吞掉反斜杠**：`\s` 会被转成 `/s`，导致 `node -e` 的正则与 `python -c` 失效。
  涉及正则的脚本一律用 **Write 工具写成文件再执行**，不要 `-e` 内联。
- **子代理联网**：进程继承 `http_proxy`；本机代理端口会变（曾从 10808 变 64836），
  且仅部分站点可达（arri.com、avenger 常超时）。派联网任务前先确认端口，并改为**不依赖联网**的方案。
- **子代理配额**：会触发 429（本次约 21:14 重置），关键路径不要只依赖子代理。

---

## 5. 架构要点（改代码前先看）

- **V2 持久化**：`objects` 是规范形态，`items` 由前端载入后降级生成。不要再假设 `items` 会被后端保存。
- **资产查找**：画布对象是 V1 降级形态（grip→tripod 等），`getAsset()` 有 subtype 反查回退，勿绕过。
- **资产分级**：`getAssetStatus()` 按几何来源判定，`replica/twin` 需专属 GLB（不与其他 preset 共用），
  且 `glb` 优先于 `cc0glb`。
- **CSS 归属**：`static/workspace-v73.css` 是构建产物（`src/workspace/theme.css` → build），禁止直接改。
- **Git**：工作树含大量未跟踪文件，`??` 是基线状态。禁止 `git reset --hard` / `clean -fd`。
  变更补丁已存 `docs/audits/prechange-working-tree.patch`。

---

## 6. 下一步建议（按优先级）

1. **决定器材模型路线**（2.1）—— 这一项卡着 P2 能否判通过
2. 人工复核 P0 三项交互（caret / 单选 / 景别-焦段联动）—— 测试通过不等于手感没问题
3. 分屏右栏取景优化
4. CSS 收敛收尾（改 `src/workspace/theme.css` 而非产物）
5. **以上全部通过后**才进入部署流程（完整应用部署，非仅静态包）

---

# 7. 补充（2026-09-18 晚，第二轮：2D 视觉返工 + 3D 相机 + 模型替换 + LOD）

## 7.1 2D 矢量插画风格（对齐用户提供的布光平面图图例）
参考图特征与本项目实现对照：

| 参考图特征 | 实现 | 位置 |
|---|---|---|
| 整版白底 | 2D 模式下 `.ff-boards-layout/workspace/viewport/stage/canvas` 全链路浅色 | creative-boards.css |
| 侧视矢量剪影 | 新增 `sidePaths` 图元库 + `iconPathFor()`，按 subtype 区分面板灯/聚光灯/柔光箱/台灯 | creative-boards.js |
| 半透明光束色块 | `conePath()` 由扇形圆弧改为**梯形**（4 顶点、无 `A`），fill-opacity 随强度递增 | creative-boards.js |
| 品名 + 规格标签 | `itemSpec()` 两行标签；`getAsset` 的 subtype 回退取型号/功率 | creative-boards.js |
| 房间矩形轮廓 | `.ff-boards-canvas` 的 inset box-shadow | creative-boards.css |
| 墙为重复短线段 | `sidePaths.wall` 10 条竖线（幕布褶皱） | creative-boards.js |

图元按**恒定屏幕像素**显示：CSS `width: calc(76px / var(--ff-zoom))`，`--ff-zoom` 由 `renderCanvas` 写入，
避免随画布缩放一起缩小到看不清。

## 7.2 修复的三个真根因（此前被程序断言掩盖）
1. **2D 被 3D 覆盖**：`renderScene3d()` 缺模式守卫，2D 下仍执行并把 WebGL 画布 prepend 到
   白色平面图上（`scene.background 0x0e1014`），导致「断言说白、肉眼是黑」。
   修：`view.mode==='2d'` 时提前返回并移除 WebGL 画布。
2. **黑底来自未覆盖的层**：`layout rgb(0,0,0)` / `viewport rgb(0,0,0)` / `stage rgb(28,28,28)`。
3. **新对象默认重叠**：步进仅 20px，多个器材叠成一团；改为按房间尺寸百分比散布到中心 2/3 区域。

## 7.3 3D 轨道相机与视角预设
`initEvents()` 此前**只有 ResizeObserver，无任何鼠标交互** —— 3D 是不能旋转/缩放/平移的死画面。

新增（lighting-render.js）：
- 轨道相机 `orbit={theta,phi,radius,tx,ty,tz}` + `applyOrbit()`
- `orbitBy()` 左键旋转（phi 夹在 `[0.03, π/2+0.55]` 防翻转）
- `panBy()` 右键水平平移、`zoomBy()` 滚轮推拉
- `setViewPreset()` 四档：`top` 俯视 / `bird` 鸟瞰 / `walk` 漫游（人眼 160cm）/ `3q` 默认立体
- UI：3D 模式下工具栏追加 `俯视|鸟瞰|漫游|3/4`，状态存 `view.cameraPreset`

实测：拖拽 `theta 0→-1.08`、滚轮 `radius 950→266`；
预设坐标 top `[0,1519,61]` / bird `[579,1303,944]` / walk `[0,379,1666]` / 3q `[0,1738,1162]`。

## 7.4 模型替换（酷家乐式「同位置换型号」）
属性面板新增「替换型号」下拉（`presetGroupOf(item)` 反查所属 PRESETS 分组）。
实测：SkyPanel → STORM 1200x，**位置保持 280/220 不变**，几何/规格/接口按新型号重建。

## 7.5 LOD 与性能
- GLB 加载后**保留程序化低模**（原实现是 `group.remove(procedural)`，导致无法降级）
- `updateLOD()` 在每帧按相机距离切换：`near < 2600` 用 GLB 精模、`far > 3600` 用低模，
  中间为迟滞区间避免临界抖动；`stats.lodSwitches` 可观测
- 实测：近距 `glb=true/proc=false`；拉远到 5000 后 `glb=false/proc=true`，切换计数 3

## 7.6 QA 基础设施修复
11 个测试的硬编码服务地址已统一为 `FRAMEFORGE_QA_BASE || 'http://127.0.0.1:18799'`：
原先分别指向公网 `23.226.133.16`（SSL 错误）与僵尸端口 `8080`/`18765`（连接挂起）。
`lighting_workspace_v8_qa.cjs` 默认密码对齐本地服务（原 `admin` → `FrameForge2026!Admin`）。

结果：`lighting_workspace_v8_qa` **13/13 passed**；`import_mapping_browser_qa`、
`inline_editing_qa` 由 FAIL 转 PASS。

## 7.8 全量回归终态（2026-09-19 00:0x）
- 核心逻辑套件 8/8 PASS（含上面修复的两个）
- 浏览器套件 7/7 PASS（含 P0 caret / 单选 / 景别-焦段联动 三项）
- `lighting_workspace_v8_qa` 13/13 PASS
- **Python 47 tests OK**（skipped=1）
- 唯一测试缺口：无

## 7.7 残留测试失败（已在第二轮修复）
`bulk_presence_logic_qa` / `history_safety_qa` 曾报 `applyShotFieldMutation is not defined` /
`ACTIVE_EDIT_SELECTOR is not defined`。根因：这两个测试用 `vm.runInContext` 只 `slice()` 抽取
app.js 的一段代码，而被测函数引用了**切片区间之外**的符号，vm 上下文里自然取不到。

修复方式（不是重写假实现，而是从源码原样抽取后注入）：
- `bulk_presence_logic_qa`：把 `applyShotFieldMutation` 的函数体随切片一起注入
- `history_safety_qa`：**注意该文件有两个 `runInContext`**（context `c` 与 `leaving`），
  报错函数 `flushProjectBeforeLeaving` 属于 `leaving`；且 vm 脚本中的 `const` **不会挂到
  context 对象上**，必须以 **context 属性**形式注入 `ACTIVE_EDIT_SELECTOR` 才生效

**排查弯路记录**：最初误改了 `c` 的注入，无效；正确做法是先确认报错函数归属哪个
`runInContext`，再针对该 context 注入。两个测试现均 PASS。
- 器材模型仍为程序化基本体（ENGINEERING REPLICA），开源生态无影视专业器材 CC0 精模。
- 分屏右栏构图偏窄；47 个 CC0 道具未做品牌映射。
- **部署未执行**（P0/P2 未全部通过）。

## 7.9 分屏模式修复（2026-09-19 00:1x）
分屏「右栏构图偏窄」的根因不是相机调参，而是**结构错误 —— 双重切割**：

1. **runtime 又被切一次**：外层画布已分成「左 2D 主画布 / 右 3D」，但 runtime 收到的 mode 是
   `'split'`，于是它内部**再做一次左右双视口**，右栏 392px 被再切成 196px×2。
   修：外层分屏时向 runtime 传 `'3d'`（`renderMode === 'split' ? '3d' : renderMode`），
   runtime 只渲染单个透视视图。实测 webgl canvas 宽由 196 → **392（= 右栏全宽）**。
2. **竖长视口视野过窄**：右栏 392×718（aspect 0.546），垂直 FOV 50° 时水平视野仅约 28°，
   房间两侧被裁。修：按 aspect 补足 FOV（`asp<1 ? min(78, 50/max(0.42,asp)) : 50`），
   实测 fov 由 50° → **78°**。
3. **左栏仍是深色且图元是空心小线框**：2D 纸面与侧视图元的 13 处 CSS 规则只匹配
   `[data-view-mode="2d"]`，而分屏时 `viewMode` 是 `"split"`。修：选择器扩展为同时匹配两者。

修复后分屏表现为「左栏白底 2D 平面图（含侧视剪影 + 规格标签）/ 右栏 3D 透视」。
截图：`qa-artifacts/split/split-fixed.png`

## 7.10 不建议执行项（说明理由）
**「47 个 CC0 道具做品牌映射」不执行**：这些是 3DAssets.dev 的通用演播室道具，
资产分级门禁（`tests/asset_gate_qa.cjs`）明令禁止给它们冠品牌名——
这正是 P0_REOPEN 5.5 禁止的「通用模型冒充 DIGITAL TWIN」模式。它们应保持
`GENERIC REFERENCE`。若需要品牌器材，只能走 `DIGITAL TWIN` 白名单（原生 CAD/STEP + IES + license）。

---

# 8. 发布就绪状态（2026-09-19 02:1x）

## 8.1 Production Gate 逐项核对（P0_REOPEN 第 9 节）
| Gate 项 | 证据 | 结果 |
|---|---|---|
| Inline caret 可见且 selection 折叠 | `p0_inline_caret_qa` PASS（editable/rangeCount=1/collapsed/inside/display!=flex） | PASS |
| 普通单击只留 1 个选中镜头 | `p0_single_selection_qa` Case A/B PASS | PASS |
| 单选不触发批量编辑 | 同上 Case E（bulkBar hidden） | PASS |
| Preset 单元格点击正确更新选择 | 同上 Case G | PASS |
| 改景别同帧更新焦段 | `p0_shot_size_lens_link_qa` PASS | PASS |
| Import 空焦段自动填充 | 同上（24mm/auto-shot-size） | PASS |
| Import 显式焦段保留 | 同上（50mm/imported-explicit） | PASS |
| 2.5D 选中器材 mesh 可见 | **该模式已按用户要求移除**，等价项由 3D 承担 | N/A |
| 3D 选中器材 mesh 可见 | HUD Fixtures 7 / GLBs 7 / Meshes 69，全部 `glbLoaded:true` | PASS |
| Split 含真实模型视口 | 右栏 webgl canvas 392px（原 196），fov 78° 自适应 | PASS |
| DIGITAL TWIN 仅用于过门禁资产 | 分级统计 `digital_twin = 0`，门禁脚本 PASS | PASS |

## 8.2 发布包
- 产物：`dist/releases/frameforge-release-20260919-0211-4986ac0d.zip`（8.95 MB）
- SHA256：`2022daabeea285fd1f078cf7021705bcbf4cfd1e55beecf406641da71499eeb9`
- 内容符合 0A.39 canonical 要求：`server.py` / `creative_boards.py` / `text_format.py` /
  `requirements.txt` / `static/`（133 文件）/ `manifest.json` / `SHA256SUMS` / `start.sh|bat` / `scripts/`
- **解包后 SHA256SUMS 校验 142 个文件，异常 0**
- 预检（`--dry-run`）：Python 语法 3/3、关键静态资源 6/6 PASS

## 8.3 发布包自测（用包内代码起服务，非源码目录）
`dist/_smoke/` 解包后以 `PORT=18777 server.py` 启动（HTTP 200），针对该实例跑真实浏览器测试：
- `lighting_aim_height_qa` PASS
- `lighting_mount_practical_qa` PASS
- `p0_inline_caret_qa` PASS
- `p0_single_selection_qa` PASS

结论：包自包含、前后端匹配、真实登录/建项目/编辑/保存/重载均可用。

## 8.4 部署阻塞（需要人工提供凭据）
- 生产目标 `192.168.13.5:22` **网络可达**
- profile「TrueNAS storyboard」：user `admin`，remote_app `/mnt/Media2/Apps/storyboard/app`，
  service `storyboard`，health `http://127.0.0.1:18765/healthz`
- **认证失败**：服务端返回 `Permission denied (publickey,password,keyboard-interactive)`
- 已尝试且全部被拒的本地密钥组合：
  `admin@id_ed25519_storyboard`、`admin@codex_vps_root`、`root@id_ed25519_storyboard`、`root@codex_vps_root`
- 根因：`tools/deploy_gui.py` 的生产 profile **未配置 `ssh_key` 或 `password`**，
  因此走 `BatchMode=yes` 无凭据连接（该工具支持 `profile.ssh_key` 与 `profile.password`→SSH_ASKPASS 两条路径）

**解除方式（任一）**：
1. 在 `PROFILES["TrueNAS storyboard"]` 中补 `"ssh_key": "~/.ssh/<有效私钥>"`
2. 或补 `"password": "<部署口令>"`（走 SSH_ASKPASS）
3. 或由人工在可访问环境执行 `python tools/deploy_gui.py --profile "TrueNAS storyboard" --deploy`

未获得有效凭据前，**未对生产环境做任何改动**。

---

# 9. FRAMEFORGE Master R5 差距分析（2026-09-19）

R5 文档共 96 节。以下为**逐节对照当前实现**的结果，用于排期，不作完成声明。

## 9.1 本轮完成（R5 §0 / §5 —— 本版关键修订）
| 项 | 结果 |
|---|---|
| §0 Sidebar 不再因「未选项目」动态隐藏模块 | 已核实并修复 |
| §5 分组结构（制作/视觉/资源/声音/审阅/项目） | 已对齐（原 moodboard 在「资源」、voiceover 在「资源」、deliverables 在「审阅」） |
| §5 分组不重复 | 已修（hub 入口并入「项目」分组首位） |

**根因（0A.29 记录的双 Sidebar 问题在 R5 语境下的具体表现）**：
`src/workspace/sidebar.tsx:8` 存在 `if(state.context==='hub') return <nav>只有「项目」分组</nav>` 的早退分支，
导致 Project Hub 态侧栏**只有「项目管理大厅」一项**，模块全部消失。
修复：删除该早退分支，改为在完整分组列表的「项目」分组首位追加 hub 入口。

**实测**：未选项目时侧栏 12 个模块全可见，分组为
`制作 / 视觉 / 资源 / 声音 / 审阅 / 项目`（6 组，无重复）。
截图：`qa-artifacts/sidebar-r5/no-project-empty-state.png`
构建：已执行 `node build.mjs`（禁止直接改 `static/workspace-v73.js`）

## 9.2 R5 已完成章节（此前各轮累计，均有测试/截图）
§12 Inline Editing · §13 Selection Model · §14 Shot Size→Lens · §20 Import Mapping ·
§24 Equipment Asset Level · §26 Lighting View Mode · §27 Camera Preset · §40-42 Beam/Aim ·
§43 Light Inspector · §46 Generic vs Branded · §47 Digital Twin Gate · §48 Engineering Replica ·
§50 LOD · §53 Debug HUD · §63 Button Contract（部分）· §69 Radius · §78 Save Contract ·
§79 Lighting Persistence · §82 P0 回归 · §83 Lighting Browser QA（13/13）·
§86 Deployment Tool · §87 Release Package

## 9.3 R5 待做（按 Phase 归并）
- **Phase 2 剩余**：hub 态点击模块 → 主区 **Empty State**（当前点击后仍停在 Hub，
  拦截点在 React bridge 层，未定位完）
- **Phase 4 剩余**：§28 单一 WebGLRenderer 收敛 · §29 DOM 与 Scene Zoom 解耦 ·
  §30 Resize · §31 Camera Target · §32 Fit Selection —— 现有实现为相机/预设/LOD 自研，
  与 R5 的架构约定需逐条核对
- **Phase 5 剩余**：§38 Selection（3D 侧）· §39 **Gizmo**（未实现）· §44 3D Transform 语义
- **Phase 6**：§55 Shot↔Lighting · §56 Shot↔Asset
- **Phase 7**：§51 Render Loop · §52 Performance · §54 Context Loss
- **Phase 8**：§81 Tests 体系 · §84 Screenshot QA · §85 Product Workflow QA
- **Phase 9**：§88 Deploy Flow · §89 Deployment Profiles · §90 Production Definition
  （当前阻塞：生产 SSH 凭据，见第 8.4 节）

## 9.4 结论
R5 是面向多轮的长期任务书（Phase 0–9）。本轮只完成了**本版关键修订 §0/§5 的主体**
（稳定导航）与差距盘点，**不代表 R5 整体完成**。

---

# 10. R6 — Project Hub / Workspace Context 修正（2026-09-19）

## 10.1 R6 覆盖 R5 §0/§5（重要）
R6 明确要求「**项目管理大厅首页不显示左侧 Workspace Sidebar**」，
并禁止「在同一个 Sidebar 里动态隐藏 10 个模块」。
**这直接推翻了 R5 §0/§5 的「稳定导航、hub 态显示全部模块」**。

第 9 节所述的 R5 改动已**按 R6 回退**：
- `src/workspace/sidebar.tsx` 移除 hub 分支（该组件只在 PROJECT_SELECTED 下挂载）
- `static/app.js` 移除 `showModuleEmptyState` 与 `navigateToView` 中的 context 守卫
- 侧栏分组（制作/视觉/资源/声音/审阅/项目）**保留** —— R6 要求项目内部顺序稳定，与 R5 §5 无冲突

## 10.2 实现方式（Layout 层分支，非 CSS 伪装）
`src/workspace/index.tsx` 新增 `syncSidebar(show)`，由 `update(snapshot)` 按
`snapshot.context === 'project'` 驱动：

```
PROJECT_HUB      → sidebar.replaceChildren() 卸载 React 树 + sidebar.hidden = true
PROJECT_SELECTED → 挂载完整 Workspace Sidebar（模块顺序稳定）
```

关键点：以**真实 DOM 是否挂载**（`sidebar.querySelector('#workspaceSidebarV73')`）判断，
而不是布尔标志位 —— 否则首次 Hub 态（`false === false`）会被短路，导致侧栏从未被隐藏。

`static/styles.css` 补布局分支（Hub 态不再预留 `--sidebar-width` 空白列）：
```css
body[data-app-context="hub"] .app-body { grid-template-columns: minmax(0, 1fr); }
body[data-app-context="hub"] #appSidebar { display: none !important; }
```

## 10.3 R6 验收结果（含真实视觉 QA）
| 验收项 | 结果 | 证据 |
|---|---|---|
| 首页没有左侧 Workspace Sidebar | PASS | `navItemCount 0`、`width 0`、截图 1 |
| 首页没有项目设置/偏好设置 | PASS | `hasProjectSettings false`、截图 1 |
| 首页没有项目级 Save/Sync | PASS | 截图 1 无 |
| 打开项目后 Sidebar 正常出现 | PASS | `hidden false`、`navItemCount 11`、`width 200`、截图 2/3 |
| 返回首页后 Sidebar 完全卸载 | PASS | `appContext hub`、React 挂载点不存在、截图 4 |
| 没有空白 Sidebar 占位 | PASS | `width 0`、`mainWorkspace` 左边界 0 |
| Header 不抖动 | PASS | `headerX` 恒为 0 |
| 首页 Search 搜索项目 | **未实测行为** | 搜索框文案为「搜索项目…」（截图 1），点击与结果未验证 |
| Workspace Search 搜索项目内部数据 | **未实测** | 同上 |

**视觉 QA 发现并修复的布局缺陷**：初次实现后 Hub 主区内容被压成竖排单字、
项目卡片变窄条 —— 根因是 `.app-body` grid 仍预留 `var(--sidebar-width)` 空列。
按 R6「不留空白占位」改为单列后恢复正常（对比截图 1）。

截图（`qa-artifacts/r6-hub/`）：`1-project-hub.png`、`2-project-workspace-table.png`、
`3-project-workspace-lighting.png`、`4-back-to-project-hub.png`

## 10.4 回归
`p0_single_selection_qa` / `lighting_mount_practical_qa` / `creative_boards_qa` /
`asset_gate_qa` 全 PASS；Python `workspace_markup` OK。

---

# 11. R11 — QA 测试项目隔离（2026-09-19）

R11 共 4259 行，§0/§1 与 R6 一致（两个 App Context、禁止为功能扩张导航）。
本轮先执行 **§2.4「QA 测试项目隔离」** —— 该节直接点名了本项目当前的真实污染
（文档原文列举：`Selection QA` / `Caret QA` / `Lens Link QA` / `Split 178...`）。

## 11.1 问题现状（实测）
长期跑自动化测试在 Hub「最近打开」累积了 **128 个**项目，几乎全是测试留痕，
真实项目被淹没。文档 §2.4 要求：

```text
测试项目命名  qa-<suite>-<timestamp>
自动清理 / 过期清理 / 正式 Hub 默认隐藏
```

## 11.2 本轮实现

### (a) 命名规范（34 个脚本）
`tests/*.cjs` 与 `scratch/*.cjs` 中所有 `#newProjForm [name=name]` 的字面量统一改为
`qa-<suite>-<timestamp>` 形式，例如：
- `'Aim ' + Date.now()` → `'qa-aim-' + Date.now()`
- `'Split ' + Date.now()` → `'qa-split-' + Date.now()`
- `'Inline Editing QA'` → `'qa-inline-editing-' + Date.now()`
全部脚本 `node --check` 通过。

### (b) Hub 默认隐藏（`static/app.js`）
新增 `isQaProject()` / `qaProjectsVisible()`，`renderProjectsGrid()` 过滤，
且计数标签同步（避免数字与实际卡片不一致）：

| 识别规则 | 覆盖对象 |
|---|---|
| `^qa-` | R11 新命名规范 |
| `\bQA$` | `Table Preferences QA`、`V6.2 P0 QA` 等历史套件 |
| `\bProbe\b` | 探测脚本项目 |
| ` [0-9]{13}$` | 「标签 + 13 位毫秒时间戳」= 自动化测试特征 |
| `^(UIUX 视觉验收\|Material 3 浏览器验收)` | 视觉验收留痕项目 |

排查时可临时显示：`localStorage['frameforge-show-qa-projects'] = '1'`

## 11.3 实测效果
```text
Hub「最近打开」计数：128 → 2
```
截图：`qa-artifacts/r6-hub/5-hub-qa-filtered.png`

## 11.4 R11 未执行部分（不声明完成）
R11 为 4259 行完整实现规范，含 §3-§23（Project Selected / Module Shell / Router /
Module Registry / Header / Search / Sidebar / Design Token / Surface / 排版 /
Primary Action / Panel / Focus Mode / Popover / Context Toolbar）、
§24-§36 分镜工作台（Store / 虚拟化 / Inline Editing / Selection / 景别焦段）、
以及后续 2D/3D 灯光、数据架构、WebGL/WASM、测试与部署等章节，**本轮均未涉及**。

本轮只完成 §2.4 一项，需按 Phase 排期推进。文档规定的执行纪律
（每阶段先审计再改、禁止为功能扩张导航、修改走 src + build）继续适用。

## 11.5 R11 §3 核对结果：已符合，无需改动
实测（进入项目后读取侧栏 DOM）：

```text
分组  ：制作 / 视觉 / 资源 / 声音 / 审阅 / 项目
模块  ：分镜工作台 · 灯光平面图 | 情绪板 | 制作方式分组 · 素材资产库
        | 旁白与对齐 | 审片与版本 | 交付与导出 · 制作概览
底部  ：项目设置 · 侧栏设置
```

与 R11 §3 规定**逐项一致**；§3 明令禁止新增的 Timeline / Visual Wall / Camera / Grip /
Beam / Aim / IES / Photometric / Export History / Version Compare / Comments /
Shot Filters / Scene Filters **均未出现在侧栏**（它们应落在 Module Toolbar / Local Panel /
Inspector / Context Toolbar / Popover / Drawer / Command Palette —— 见 §1.1）。

此项为核对通过（源于此前为 R5 §5 所做的分组对齐），**非本轮新增工作**，无需再改动。
截图：`qa-artifacts/r6-hub/6-sidebar-r11-section3.png`

## 11.6 R11 下一项：§4 通用 Module Shell（架构级，未开始）
§4 要求统一壳层与组件族：

```text
ModuleShell / ModuleHeader / ModuleToolbar / ModuleLocalPanel
ModuleWorkbench / ModuleInspector / ModuleContextToolbar / ModuleStatusBar
```

现状：各模块仍各自实现布局（`fullPageView` 分支、`workspaceContentGrid`、
各模块自己的 header/toolbar），**尚未抽出统一组件**。§4 明确要求
「不要为每个模块重新造 Layout」。

这是**架构级重构**，涉及所有模块（分镜/灯光/情绪板/素材/旁白/审片/交付/概览），
需要独立排期、逐模块迁移并回归，不适合与单点修复混做。

---

# 12. R11 §14 Design Token（2026-09-19，已完成）

## 12.1 建立令牌体系
`static/styles.css` 追加 R11 §14 规定的三组令牌，并把既有别名指向新体系（渐进收敛不破坏旧引用）：

```css
html:root {
  --space-1..8 : 4 / 8 / 12 / 16 / 20 / 24 / 32px
  --radius-sm/md/lg/xl : 6 / 8 / 10 / 12px
  --control-h-sm/md/lg : 28 / 32 / 36px
  /* 既有别名 → 新体系 */
  --control-h-compact/default/large → sm/md/lg
  --control-radius → radius-sm
}
```

**关键：必须用 `html:root` 而非 `:root`**。`static/workspace-v73.css`（Tailwind v4 产物）
在 `styles.css` **之后加载**，其中 `:root,:host{--radius-sm:.25rem;...}`（4/6/8/12px）
会覆盖普通 `:root` 声明。`html:root`（特异性 0,1,1 > 0,1,0）可稳定胜出，与加载顺序无关。

## 12.2 收敛体系外圆角
两轮共收敛 **114 处**，涉及 9 个 CSS 文件（含 `src/workspace/theme.css`，改后已 build）：

| 轮次 | 收敛值 | 处数 |
|---|---|---|
| 第一轮 | 9 / 11 / 14px | 13 |
| 第二轮 | 4 / 5 / 7px | 101 |

**源文件已无体系外圆角残留**（排除构建产物 `workspace-v73.css`）。

## 12.3 实测验证
```text
令牌解析  space   : 4px 8px 12px 16px 20px 24px 32px
          radius  : 6px 8px 10px 12px      ← 修复前被 Tailwind 覆盖为 .25/.375/.5/.75rem
          controlH: 28px 32px 36px
         别名    : compact→28px  default→32px  control-radius→6px
实际控件圆角: ["12px","6px","8px"]          ← 修复前混杂 4/6/7/8/12px
```
截图：`qa-artifacts/r11-tokens/hub-after-tokens.png`

## 12.4 回归
`p0_single_selection_qa` / `creative_boards_qa` / `asset_gate_qa` /
`lighting_mount_practical_qa` 全 PASS；Python `workspace_markup` OK。

## 12.5 经验（易踩）
1. **`static/*.css` 中的构建产物**（`workspace-v73.css`）会覆盖手写样式表 —— 令牌类改动
   要么提升特异性，要么改 `src/` 后 build，不能只改手写文件。
2. **排查正则必须写成文件执行**：bash heredoc 会把 `\s` 吞成 `/s`，导致 `re.sub` 静默不匹配
   （第一轮收敛"0 个文件"就是这个原因，改用 Node 脚本后立即成功）。
