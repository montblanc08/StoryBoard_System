# 专业影视分镜与镜头制作管理系统
## Master Specification V3.0

### 0. 产品名称与定位
单公司私有部署、以 Shot 为核心、面向专业影视制作管线的分镜、镜头规划、制作方式管理、素材版本、审片审批与交付平台。
- 适用范围：电影、剧集、纪录片、TVC、广告片、企业宣传片、MV、MG、Motion Graphics、Animation、3D、VFX、Previs / Techvis。
- 当前不启用实际 AI 推理能力，预留 Provider Contract。

### 1. 核心原则
- **Shot = Source of Truth**：所有页面只是同一 Shot 数据的不同表达。
- **层级关系**：`Production -> Reel / Episode -> Sequence -> Scene -> Shot -> Panel / Version / Asset / Task`
- **制作方式是一级数据**：`LIVE`, `STOCK`, `CLIENT`, `ARCHIVE`, `STILL`, `AE`, `MG`, `3D`, `VFX`, `TYPE`。
- **制作步骤独立建表**：`Production Steps` 与制作方式分离。
- **SMPTE 帧级时码**：所有时长均以整数帧存储，支持 Drop-Frame (DF/NDF)。
- **旁白自动计时**：基于中英文字数、标点权重（逗号/句号/问号/感叹号/省略号/段落）与目标总片长进行无漂移分配。
- **内外网隔离**：外网零业务数据驻留，内网处理并持久化所有业务数据。
