# Codex Implementation Specification
## 专业影视分镜与镜头制作管理系统
版本：V1.0 Implementation Ready

### 1. 技术栈
- **Frontend**: Next.js 15+ (App Router), React, TypeScript, Tailwind CSS, Radix UI / shadcn/ui, Zustand, TanStack Query, dnd-kit, TanStack Table, TanStack Virtual.
- **Backend**: FastAPI, Python 3.12+, Pydantic v2, SQLAlchemy 2, Alembic.
- **Database**: PostgreSQL 16+ (SQLite fallback support for zero-dependency standalone mode).
- **Queue & Storage**: Redis + RQ, S3 Compatible Storage (MinIO / TrueNAS / Local File Adapter).
- **Packages**:
  - `packages/ui` (Design system tokens, base components, dark/light theme, Sarasa Gothic, Google Material Symbols offline sprite).
  - `packages/types` (Shared domain contracts & TypeScript interfaces).
  - `packages/timecode` (SMPTE timecode math, DF/NDF, VO auto-timing engine).
  - `packages/contracts` (API models & Provider interfaces).
  - `packages/config` (Tailwind, ESLint, TypeScript base configs).

### 2. 核心数据表
- `users`, `roles`, `productions`, `sequences`, `scenes`, `shots`, `panels`, `production_steps`, `assets`, `asset_versions`, `shot_asset_links`, `stock_asset_metadata`, `client_asset_requests`, `comments`, `approvals`, `shot_versions`, `audit_logs`, `shares`, `exports`.

### 3. 语言与模式
- 界面支持中英文双语 (i18n: `zh-CN` / `en-US`)。
- 支持深色/浅色双模式 (Dark / Light Theme)。
- 离线加载 Google Icons (Material Symbols) 与更纱黑体 (Sarasa Gothic)。
