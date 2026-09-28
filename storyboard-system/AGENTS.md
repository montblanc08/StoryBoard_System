# FrameForge storyboard-system 工作规则

## 指令与操作边界

- 遵循当前对话中用户最近一次明确指令；用户指令优先于本文件。当前明确要求不部署，除非用户之后明确改口，否则不要执行会改动线上服务的命令。允许本地构建、隔离数据下的测试及只读核查。
- 用户要求整理或删除时，先列出候选文件并用引用、构建入口、Git 状态和数据归属核实用途。未知来源、用户内容、素材、备份和运行数据要保留；不要用 `git clean`、递归删除或批量移动代替逐项核对。
- 不覆盖已有工作。操作前看 `git status --short`；构建前确认生成物是否有未提交修改。
- 针对改变的数据契约和交互路径运行必要的隔离测试；说明实际运行的命令和结果，不用测试替代真实浏览器视觉验收。

## 项目与运行数据边界

- `server.py` 提供 HTTP/API、静态文件、认证和 SQLite 访问；当前直接依赖根目录 `creative_boards.py`、`field_lifecycle.py`、`text_format.py`、`asset_cleanup.py`、`narration_timing.py`、`delivery_exports.py`、`shot_updates.py`、`shot_bulk_updates.py`、`shot_versions.py`、`persistence_helpers.py`、`runtime_clock.py`、`import_parsing.py`、`import_staging.py`、`schema_migrations.py`。修改/拆分服务端逻辑时保留这些运行依赖及现有 API 契约。
- `static/index.html` 加载 `static/app.js`、工作区 bundle 和多份功能脚本、样式及媒体资源。不得仅因名称相似或位于 `static/` 就认定文件未使用。
- 运行数据由 `STORYBOARD_DATA_ROOT` 决定，含 `storyboard.db`、`media/`、`exports/`、`import_staging/`、`avatars/`。未设置时默认指向项目 `data/`；线上配置位于独立的 `storyboard.env`。这些目录/配置含真实业务数据或机密，测试必须使用临时数据根目录，任何清理、复制、覆盖或迁移都要先核实路径并得到用户明确授权。
- 保留真实 Excel 导入能力，包括 `.xlsx` 解析、字段映射、嵌入图片和原始导入列。不要用“只支持 CSV”替代，不要删除真实工作簿回归覆盖。`tests/test_v62_import_xlsx.py` 会尝试读取用户桌面上的 V4 工作簿；本地文件缺失时允许按测试设计跳过，不要复制真实工作簿进源码、静态资源或发布包。合成工作簿契约覆盖也应保留。

## 源码、构建产物与发布包

- 前端构建输入为 `src/material-web.js`、`src/three-bundle.js`、`src/workspace/**` 和 `packages/ui/src/**`。`npm run build` 以及会调用它的 `npm run check` 会覆盖 `static/workspace-v73.js`、`static/workspace-v73.css` 和 `static/vendor/` 生成文件；运行前确认这些目标没有用户改动。
- `static/` 混有手写运行资源、构建输出、第三方资产、许可和媒体。只根据具体引用关系和生成命令分类；不要整目录清理或盲目重建。
- `tests/`、测试夹具和测试表格只用于开发/验收，禁止进入发布包。修改打包规则时用发布清单明确允许的运行文件，并检查静态目录内递归资源；`.gitignore` 只控制 Git 状态，不会阻止打包器复制文件。
- `data/`、`.qa-data/`、`.qa-live/`、`qa-artifacts/`、`dist/`、`deployments/`、`scratch/`、`merge-backups/`、`node_modules/` 和 `.npm-cache/` 可能含用户数据、诊断证据、历史包或可重建依赖。忽略或命名为临时不等于可以删除。

## 验收

- Python 回归入口：`python -m unittest discover -s tests -v`。先确认测试隔离在临时目录，不触碰项目或线上 `data/`。
- 表格列管理可用 `python tests/run_column_lifecycle_browser_qa.py` 验证；相关状态级检查在 `tests/column_manager_qa.cjs`。根据改动选择有针对性的浏览器 QA，不因某个脚本通过就宣称所有视觉状态正确。
- 视觉/UI 改动要在浏览器查看实际渲染并保存/检查截图。表格相关改动的截图验收必须包含列管理弹出面板，以及列标题/单元格右键菜单的打开、可见范围、交互和关闭状态；检查窄屏/滚动下没有裁切或遮挡。只看 CSS 或无头断言不算完成视觉验收。
- 改动 Excel 导入时，覆盖真实工作簿回归（若本机附件存在）和合成夹具；检查表头定位、行数、字段映射、嵌入图像及原始列。报告附件缺失导致跳过的项目，不要把它说成已通过。
