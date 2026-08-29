# FrameForge OS · 生产部署与系统运维手册

> **版本**: V1.0 Implementation Ready  
> **定位**: 单公司私有部署、内外网分离架构、以 Shot 为核心的专业影视分镜与镜头制作管理系统。

---

## 1. 架构拓扑与数据流 (Architecture & Data Flow)

```text
[ 外部网络 / 访客 / 移动端 ]
            │
            ▼ (HTTPS 443 / L4 TLS Passthrough)
┌─────────────────────────────────────────────────────────┐
│ 外网节点 (External Gateway - 零数据驻留)                   │
│ • 通用静态应用壳                                         │
│ • 无状态密文流式转发 (proxy_buffering off)               │
│ • 零业务数据 / 零令牌 / 零日志持久化                     │
└────────────────────────────┬────────────────────────────┘
                             │ (mTLS / 加密出站连接)
                             ▼
┌─────────────────────────────────────────────────────────┐
│ 公司内网服务器 (Internal Server - 核心数据总节点)        │
│ ┌───────────────────────┐   ┌─────────────────────────┐ │
│ │ Next.js 15+ Web (3000)│   │ FastAPI 核心服务 (8000)  │ │
│ └───────────────────────┘   └────────────┬────────────┘ │
│ ┌───────────────────────┐                │              │
│ │ Redis 队列 + Worker   │                ▼              │
│ └───────────────────────┘   ┌─────────────────────────┐ │
│ ┌───────────────────────┐   │ PostgreSQL 16+ (5432)   │ │
│ │ MinIO 对象存储 (9000) │   │ • Shot = Source of Truth│ │
│ └───────────────────────┘   └─────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 部署方案 A：Docker Compose 生产编排（推荐）

### 前置要求
- Docker Engine 24.0+ 与 Docker Compose v2
- 内存建议: 8GB+，磁盘空间: 50GB+ (SSD)

### 快速启动
```bash
# 1. 克隆项目并进入根目录
git clone <repo_url> && cd <repo_dir>

# 2. 从模板复制环境变量
cp .env.example .env

# 3. 启动所有微服务容器
docker compose up -d

# 4. 检查服务健康状态
docker compose ps
```

### 默认网络服务地址
| 模块 | 容器名 | 默认端口 | 说明 |
| :--- | :--- | :--- | :--- |
| **Web 前端** | `frameforge_web` | `http://localhost:3000` | Next.js 15+ 制作工作台 |
| **API 后端** | `frameforge_api` | `http://localhost:8000` | FastAPI 核心业务接口与 Swagger 文档 (`/docs`) |
| **MinIO 存储** | `frameforge_minio` | `http://localhost:9000` / `9001` | S3 兼容媒体代理对象存储与管理控制台 |
| **PostgreSQL** | `frameforge_postgres` | `5432` | 核心数据库 |
| **Redis** | `frameforge_redis` | `6379` | 异步导出队列 |

---

## 3. 部署方案 B：本地极速独立运行 (Standalone Mode)

对于单机本地演示或离线工作站环境：

```bash
# 1. 运行一键跨平台启动引导
python scripts/start_standalone.py

# 2. 启动独立轻量原型服务 (端口 8080)
python storyboard-system/server.py
```

---

## 4. 默认管理员账号与预载工程

* **管理员邮箱**: `admin@company.internal`
* **管理员初始密码**: `FrameForge2026!Admin`
* **内置示范工程**: 天津国际农产品交易中心 · 4分30秒形象宣传片 (80 镜高清分镜全量元数据与时码预填)。

---

## 5. 外网零驻留合规审计验证

```bash
python scripts/verify_zero_residency.py
```
该脚本将严格扫描外网网关配置文件、代理缓冲参数及日志格式，确保任何情况下业务明文数据均不留存于外网节点。

---

## 6. 自动化测试套件执行

```bash
# 运行全部 19 项单元与集成测试套件 (Phase 0 + Phase 1 + Phase 2 + Phase 3)
python tests/backend/test_phase0_runner.py ; python tests/test_phase1_runner.py ; python tests/test_phase2_runner.py ; python tests/test_phase3_runner.py
```
