# PostureTracker · 普拉提 AI 体态追踪器

> 为普拉提工作室提供 AI 体态评估与效果追踪 SaaS，把"教练说有效"变成"数据说有效"。

[![CI](https://github.com/121212165/posture-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/121212165/posture-tracker/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## 项目简介

PostureTracker 是面向中国高端普拉提工作室的 **AI 体态评估 + 效果追踪 SaaS**，解决行业"效果不可见、不可量化"的核心痛点：

- **售前体态报告卡**：用专业数据打动高净值客户购买私教/年卡
- **课后改善曲线**：用"效果可视化"支撑复购和转介绍
- **康复效果量化**：为康复/体态矫正衍生服务提供定价依据

通过 AI 关键点检测（MediaPipe 33 点）自动生成体态报告，并支持多期数据对比与可视化改善曲线。

## 核心能力

| 模块 | 说明 |
|------|------|
| AI 体态评估 | MediaPipe 33 关键点检测，识别圆肩/骨盆前倾/高低肩等 5 项核心指标 |
| 体态报告 PDF | 服务端生成专业体态报告卡，含可视化标注图与改善建议 |
| 多期趋势对比 | 自动对比历次评估数据，生成改善曲线 |
| H5 报告分享 | 通过 QR 码扫码分享电子版报告至学员微信 |
| 多工作室隔离 | 严格按 `studioId` 进行数据隔离，支持多租户场景 |

## 技术架构

```
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│  微信小程序（教练端） │   │  Next.js 14 H5 报告  │   │                     │
│  Native Mini Program│   │  App Router + TW    │   │                     │
└──────────┬──────────┘   └──────────┬──────────┘   │                     │
           │                          │              │                     │
           └──────────────┬───────────┘              │                     │
                          ▼                          │                     │
            ┌─────────────────────────┐              │                     │
            │  NestJS Backend (TS)    │◄─────────────┘                     │
            │  Prisma ORM + JWT       │                                    │
            └─────┬───────────┬───────┘                                    │
                  │           │                                            │
                  ▼           ▼                                            │
        ┌──────────────┐  ┌─────────────────────┐  ┌────────────────────┐ │
        │  PostgreSQL  │  │  MinIO 对象存储      │  │  AI 推理 (FastAPI) │ │
        │  多租户隔离   │  │  签名 URL 访问       │  │  MediaPipe + OpenCV│ │
        └──────────────┘  └─────────────────────┘  └────────────────────┘ ┘
```

### 技术栈

| 层 | 技术 |
|----|------|
| 教练端 | 原生微信小程序 |
| 后端 | NestJS 10 (TypeScript) + Prisma 5 ORM |
| AI 推理 | Python + FastAPI + MediaPipe + OpenCV |
| H5 报告 | Next.js 14 (App Router) + Tailwind CSS |
| 数据库 | PostgreSQL 16 |
| 对象存储 | MinIO（签名 URL 访问） |
| 部署 | Docker Compose 容器化 |

## 目录结构

```
.
├── services/
│   ├── backend/              # NestJS 后端服务
│   │   ├── src/
│   │   │   ├── common/       # 通用守卫/拦截器/过滤器
│   │   │   └── modules/      # auth / member / assessment / report / trend ...
│   │   ├── prisma/           # Prisma schema 与 migrations
│   │   └── Dockerfile
│   ├── ai-inference/         # Python FastAPI AI 推理服务
│   │   ├── app/
│   │   │   ├── pose_estimator.py   # MediaPipe 关键点检测
│   │   │   ├── calibration.py      # 体态指标计算
│   │   │   └── metrics.py          # 圆肩/骨盆前倾等指标
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   ├── h5/                   # Next.js 14 H5 报告端
│   │   ├── app/
│   │   ├── components/
│   │   └── Dockerfile
│   └── miniprogram/          # 原生微信小程序
│       └── pages/            # 登录 / 学员 / 评估创建 / 报告 / 趋势 ...
├── docker-compose.yml
└── docs/
    └── superpowers/specs/    # 设计文档
```

## 快速开始

### 环境要求

- Node.js 20+
- Python 3.11+
- Docker & Docker Compose
- 微信开发者工具（小程序端）

### 一键启动（Docker Compose）

```bash
# 1. 准备环境变量
cp .env.example .env
# 编辑 .env，填写 JWT_SECRET / POSTGRES_PASSWORD / MINIO 凭据 / 微信 AppID&Secret

# 2. 启动所有服务
docker compose up -d

# 3. 后端运行 Prisma migrations（首次）
docker compose exec backend pnpm prisma migrate deploy
```

启动后：

| 服务 | 地址 |
|------|------|
| NestJS Backend | http://localhost:3000 |
| H5 报告端 | http://localhost:3001 |
| AI 推理服务 | http://localhost:8000 （仅内网） |
| MinIO 控制台 | http://localhost:9001 |
| PostgreSQL | localhost:5432 |

### 本地开发（非容器化）

```bash
# 后端
cd services/backend
npm install
npx prisma generate
npm run start:dev

# AI 推理
cd services/ai-inference
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# H5
cd services/h5
npm install
npm run dev
```

## 工程约定

- **数据安全**：所有数据模型包含 `deletedAt` 软删除字段，避免物理删除
- **多租户隔离**：所有查询必须按 `studioId` 过滤
- **健康检查**：每个服务必须暴露 `/health` 端点
- **文件访问**：所有文件访问使用签名 URL
- **AI 推理**：仅暴露在内网，不对外公开
- **统一错误响应**：包含 `success` / `error.code` / `error.message` / `error.details` 字段
- **AI 推理失败处理**：
  - 关键点检测置信度 < 0.5 → 返回 `POSE_NOT_DETECTED`
  - 照片质量问题 → 返回 `PHOTO_QUALITY_LOW` 并提示重拍
  - 网络超时 → 自动重试 2 次后标记为 `FAILED`

## CI

GitHub Actions 工作流位于 [.github/workflows/ci.yml](.github/workflows/ci.yml)，覆盖：

- Backend：TypeScript 编译 + Prisma 生成 + 构建
- AI Inference：Python 依赖安装 + 模块导入检查
- H5：Next.js 构建

## License

MIT
