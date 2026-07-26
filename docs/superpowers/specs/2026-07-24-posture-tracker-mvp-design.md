# PostureTracker MVP 技术设计文档

> **产品名称**：体态追踪器 / PostureTracker
> **文档版本**：v1.0 (MVP技术规格)
> **日期**：2026-07-24
> **状态**：待审阅

---

## 1. 范围与目标

### 1.1 本次MVP范围（对应原设计M1-M3合并）

基于全栈方案选择，本次MVP包含：

| 模块 | 包含 | 不包含 |
|------|------|--------|
| AI推理 | MediaPipe 33关键点检测、5项体态指标计算 | 3D重建、课中实时辅助 |
| 后端服务 | NestJS + Prisma + PostgreSQL，完整业务API | 微服务拆分、支付系统 |
| 教练端 | 原生微信小程序（登录、拍照、学员管理、报告查看） | - |
| 学员端 | Next.js H5报告页（扫码访问，无需登录） | C端独立App |
| 报告生成 | H5报告页 + 服务端PDF生成 | - |
| 通知 | 报告二维码分享 | 微信模板消息推送（后续版本） |
| 存储 | Docker本地：PostgreSQL + MinIO | 阿里云OSS（生产切换） |

### 1.2 技术栈最终选型

| 层级 | 技术选型 | 版本要求 |
|------|----------|----------|
| AI推理服务 | Python 3.10+ / FastAPI / MediaPipe | latest |
| 业务后端 | NestJS 10+ / TypeScript / Prisma ORM | Node >= 18 |
| 数据库 | PostgreSQL | 15+ |
| 对象存储 | MinIO（本地）| latest |
| PDF生成 | Playwright（服务端渲染HTML→PDF）| latest |
| 教练端 | 原生微信小程序（TypeScript）| 基础库 2.30+ |
| 学员报告端 | Next.js 14 (App Router) / Tailwind CSS | React 18+ |
| 容器化 | Docker + Docker Compose | latest |

### 1.3 经验教训落地（必做）

基于历史项目经验，本项目严格执行以下规则：

1. **数据安全**：
   - 所有删除操作为软删除（`deletedAt`字段），禁止物理DELETE
   - 所有数据查询必须按`studioId`过滤（通过AuthGuard自动注入，不接受前端传入）
   - 文件通过签名URL访问，MinIO桶不公开

2. **NestJS约定**：
   - 后端全局API前缀：`/api/v1`（注意：前端→Next.js rewrites→后端路径三者必须一致）
   - Prisma relation必须双向声明，避免P1012校验错误
   - 公共模块（Auth、File、AuditLog）独立，避免跨模块循环依赖
   - 全局ValidationPipe开启，DTO做严格校验

3. **错误处理**：
   - `/health`端点必须可用，检查所有依赖连通性
   - 统一错误响应格式：`{ success: false, error: { code, message, details } }`
   - 区分错误类型：网络不可达/跨域/401/500，前端给出对应提示

4. **Windows兼容性**：
   - Prisma Client生成与运行解耦，不假设运行时generate一定成功
   - 非核心操作（如日志写入）失败不阻塞主业务流程
   - Docker配置适配Windows文件挂载权限

---

## 2. 系统架构

### 2.1 服务架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        客户端                                │
├───────────────┬─────────────────────────────────────────────┤
│  微信小程序    │          H5报告页 (Next.js:3001)            │
│  (教练端)      │  (学员扫码查看，微信内打开)                   │
└───────┬───────┴──────────────────┬──────────────────────────┘
        │                          │
        └──────────┬───────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│         NestJS 业务后端 (端口 3000, 前缀 /api/v1)            │
├─────────────────────────────────────────────────────────────┤
│  AuthModule      │  微信登录/JWT/Studio数据隔离守卫           │
│  MemberModule    │  学员管理（软删除）                        │
│  AssessmentModule│  评估流程、异步调用AI                      │
│  ReportModule    │  报告生成、PDF、二维码、shareToken         │
│  FileModule      │  MinIO上传/签名URL                        │
│  TrendModule     │  改善趋势计算                              │
│  HealthModule    │  健康检查端点                              │
│  CommonModule    │  异常过滤器、拦截器、DTO、Prisma服务       │
└───────┬──────────────────┬───────────────────────┬───────────┘
        │                  │                       │
        │ HTTP (内部)       │ Prisma                │ MinIO SDK
        ▼                  ▼                       ▼
┌──────────────────┐  ┌─────────────┐  ┌──────────────────────┐
│ Python AI推理    │  │ PostgreSQL  │  │  MinIO (端口9000/9001)│
│ 服务 (端口 8000) │  │ (端口 5432) │  │                      │
│  MediaPipe       │  │             │  │                      │
└──────────────────┘  └─────────────┘  └──────────────────────┘
```

### 2.2 Monorepo目录结构

```
posture-tracker/
├── docker-compose.yml
├── .env.example
├── .gitignore                    # 包含 .superpowers/ node_modules/ 等
├── services/
│   ├── ai-inference/             # Python FastAPI 姿态识别服务
│   │   ├── app/
│   │   │   ├── __init__.py
│   │   │   ├── main.py           # FastAPI入口
│   │   │   ├── models.py         # Pydantic请求/响应模型
│   │   │   ├── pose_estimator.py # MediaPipe封装
│   │   │   ├── metrics.py        # 5项体态指标计算
│   │   │   └── visualization.py  # 标注图绘制
│   │   ├── requirements.txt
│   │   ├── Dockerfile
│   │   └── .dockerignore
│   └── backend/                  # NestJS 业务后端
│       ├── src/
│       │   ├── main.ts           # 入口，配置全局前缀/管道/CORS
│       │   ├── app.module.ts
│       │   ├── common/           # 公共模块
│       │   │   ├── prisma/       # Prisma服务/模块
│       │   │   ├── guards/       # JwtAuthGuard, StudioGuard
│       │   │   ├── interceptors/ # 响应转换、日志拦截
│       │   │   ├── filters/      # 全局异常过滤器
│       │   │   ├── decorators/   # @CurrentUser, @CurrentStudio
│       │   │   └── dto/          # 分页、通用响应
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── studio/
│       │   │   ├── coach/
│       │   │   ├── member/
│       │   │   ├── assessment/
│       │   │   ├── metrics/
│       │   │   ├── report/
│       │   │   ├── file/
│       │   │   ├── trend/
│       │   │   └── health/
│       │   └── config/           # 环境配置
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── migrations/
│       ├── test/
│       ├── package.json
│       ├── tsconfig.json
│       ├── Dockerfile
│       └── .dockerignore
├── apps/
│   ├── miniprogram/              # 微信小程序教练端
│   │   ├── pages/
│   │   │   ├── index/            # 工作台首页
│   │   │   ├── camera/           # 拍照引导/拍摄
│   │   │   ├── members/          # 学员列表
│   │   │   ├── member-detail/    # 学员详情/评估历史
│   │   │   ├── assessment/       # 评估流程/上传
│   │   │   ├── report-preview/   # 报告预览/二维码
│   │   │   └── trend/            # 改善趋势
│   │   ├── components/
│   │   │   ├── member-card/
│   │   │   ├── metric-item/
│   │   │   └── qr-code/
│   │   ├── utils/
│   │   │   ├── request.ts        # 请求封装(JWT注入)
│   │   │   └── auth.ts
│   │   ├── app.json
│   │   ├── app.ts
│   │   └── project.config.json
│   └── web-report/               # Next.js H5学员报告
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── report/[token]/page.tsx  # 公开报告页（shareToken）
│       │   └── globals.css
│       ├── components/
│       │   ├── MetricCard.tsx
│       │   ├── TrendChart.tsx
│       │   └── AnnotatedImage.tsx
│       ├── lib/
│       │   └── api.ts
│       ├── public/
│       ├── package.json
│       ├── tailwind.config.ts
│       ├── next.config.js        # 配置API rewrites
│       └── Dockerfile
└── docs/
    └── superpowers/specs/
```

---

## 3. 数据模型（Prisma Schema）

> 注意：所有relation必须双向声明，所有用户数据表包含`studioId`用于多租户隔离，删除用软删除。

```prisma
// schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum PlanType {
  FREE
  PRO
  ENTERPRISE
}

enum CoachRole {
  OWNER
  COACH
}

enum Gender {
  MALE
  FEMALE
  OTHER
}

enum AssessmentType {
  INITIAL
  FOLLOW_UP
}

enum AssessmentStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

model Studio {
  id           String       @id @default(cuid())
  name         String
  logoUrl      String?
  plan         PlanType     @default(FREE)
  contactPhone String?
  address      String?
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
  coaches      Coach[]
  members      Member[]
  assessments  Assessment[]
}

model Coach {
  id          String       @id @default(cuid())
  studioId    String
  openid      String       @unique
  unionid     String?
  name        String?
  avatarUrl   String?
  phone       String?
  role        CoachRole    @default(COACH)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  studio      Studio       @relation(fields: [studioId], references: [id], onDelete: Cascade)
  assessments Assessment[]
}

model Member {
  id          String       @id @default(cuid())
  studioId    String
  name        String
  phone       String?
  gender      Gender?
  ageRange    String?
  notes       String?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  deletedAt   DateTime?
  studio      Studio       @relation(fields: [studioId], references: [id], onDelete: Cascade)
  assessments Assessment[]

  @@index([studioId, deletedAt])
}

model Assessment {
  id            String           @id @default(cuid())
  studioId      String
  coachId       String
  memberId      String
  type          AssessmentType
  photoFrontUrl String?
  photoSideUrl  String?
  keypointsJson Json?
  qualityScore  Float?
  status        AssessmentStatus @default(PENDING)
  errorMessage  String?
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
  deletedAt     DateTime?
  studio        Studio           @relation(fields: [studioId], references: [id], onDelete: Cascade)
  coach         Coach            @relation(fields: [coachId], references: [id], onDelete: Cascade)
  member        Member           @relation(fields: [memberId], references: [id], onDelete: Cascade)
  metrics       Metrics?
  report        Report?

  @@index([memberId, createdAt])
  @@index([studioId, status, createdAt])
}

model Metrics {
  id                 String     @id @default(cuid())
  assessmentId       String     @unique
  shoulderRoundness  Float
  headForward        Float
  pelvicTilt         Float
  shoulderDiff       Float
  kneeHyperextension Float
  overallScore       Float
  createdAt          DateTime   @default(now())
  assessment         Assessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
}

model Report {
  id           String     @id @default(cuid())
  assessmentId String     @unique
  h5Url        String
  pdfUrl       String?
  qrCodeUrl    String
  shareToken   String     @unique
  createdAt    DateTime   @default(now())
  assessment   Assessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
}
```

---

## 4. API接口设计

### 4.1 统一约定

- 基础路径：`/api/v1`
- 认证方式：`Authorization: Bearer <JWT>`
- 分页参数：`?page=1&pageSize=20`
- 统一响应格式（成功）：
```json
{
  "success": true,
  "data": { ... }
}
```
- 统一响应格式（失败）：
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "用户友好提示",
    "details": {}
  }
}
```

### 4.2 Auth模块

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| POST | `/auth/wx-login` | 微信code登录，首次登录自动创建Coach和默认Studio | 公开 |
| GET | `/auth/me` | 获取当前教练及所属工作室信息 | 已登录 |

### 4.3 Studio模块

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | `/studio` | 获取当前工作室信息 | 已登录 |
| PATCH | `/studio` | 更新工作室信息（Logo、名称等） | Owner |

### 4.4 Member模块

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | `/members` | 学员列表（分页、搜索，自动过滤本工作室+未删除） | 已登录 |
| POST | `/members` | 创建学员 | 已登录 |
| GET | `/members/:id` | 学员详情（含评估次数统计） | 本工作室 |
| PATCH | `/members/:id` | 更新学员信息 | 本工作室 |
| DELETE | `/members/:id` | 删除学员（软删除，设置deletedAt） | 本工作室 |
| GET | `/members/:id/assessments` | 学员评估历史（按时间倒序） | 本工作室 |

### 4.5 File模块

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| POST | `/files/upload` | 上传照片，返回文件URL和objectKey | 已登录 |
| GET | `/files/:objectKey/signed-url` | 获取文件临时签名访问URL（有效期1小时） | 本工作室 |

### 4.6 Assessment模块

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| POST | `/assessments` | 创建评估记录，触发异步AI推理 | 已登录 |
| GET | `/assessments` | 评估列表（分页、按 memberId/status/type 过滤） | 已登录 |
| GET | `/assessments/:id` | 获取评估详情（含Metrics和Report） | 本工作室 |
| POST | `/assessments/:id/retry` | 重试失败的评估 | 本工作室 |
| DELETE | `/assessments/:id` | 删除评估（软删除） | 本工作室 |

> 说明：MVP 阶段不做 `/assessments/pending` 独立端点，前端通过 `GET /assessments?status=PROCESSING,PENDING` 实现等价查询；
> 报告生成端点为 `POST /reports/assessments/:assessmentId`（见 4.7），不挂在 assessments 路由下。

### 4.7 Report模块（公开）

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | `/share/reports/:shareToken` | 通过shareToken公开获取报告数据（H5页面用） | 公开 |
| POST | `/reports/assessments/:assessmentId` | 生成报告（H5+PDF+二维码） | 本工作室 |
| GET | `/reports/assessments/:assessmentId` | 获取已生成报告（含签名URL） | 本工作室 |

### 4.8 Trend模块

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | `/trends/members/:memberId` | 获取学员5项指标的改善趋势数据 | 本工作室 |
| GET | `/trends/studio-overview` | 工作室看板统计（评估数、改善人数等） | 已登录 |

### 4.9 Health模块

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | `/health` | 健康检查（服务状态+DB+MinIO+AI服务） | 公开 |

### 4.10 AI推理服务API（内部，Python）

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/infer/pose` | 输入照片URL，返回关键点、指标、标注图URL |
| GET | `/health` | AI服务健康检查 |

---

## 5. 核心业务流程

### 5.1 微信登录流程

```
小程序                          NestJS                      微信服务器
  │ wx.login()获取code           │                           │
  ├────────────────────────────>│                           │
  │                              │  GET sns/jscode2session   │
  │                              ├──────────────────────────>│
  │                              │  { openid, session_key }  │
  │                              │<──────────────────────────┤
  │                              │                           │
  │                              │  查找Coach记录            │
  │                              │  不存在→创建Studio+Coach  │
  │                              │  签发JWT(包含coachId,     │
  │                              │         studioId, role)   │
  │  { token, coach, studio }    │                           │
  │<────────────────────────────┤                           │
```

> 开发环境兼容：无真实AppID时，使用mock openid（如`test_coach_1`）登录，方便本地开发。

### 5.2 体态评估完整流程

```
教练小程序
    │
    ├─ 选择/创建学员
    ├─ 拍照引导页面（正面/侧面提示+校准说明）
    ├─ wx.chooseMedia选图
    ├─ POST /api/v1/files/upload （上传正面照+侧面照）
    │     返回 photoFrontUrl, photoSideUrl
    │
    ├─ POST /api/v1/assessments
    │     { memberId, type: "INITIAL", photoFrontUrl, photoSideUrl }
    │     │
    │     ├─ 数据库创建Assessment记录 (status: PENDING)
    │     ├─ 异步任务队列：
    │     │     ├─ 更新状态为PROCESSING
    │     │     ├─ 从MinIO下载照片
    │     │     ├─ 调用Python AI服务 /infer/pose
    │     │     ├─ 保存keypointsJson和Metrics记录
    │     │     ├─ 绘制标注图上传到MinIO
    │     │     ├─ 更新状态为COMPLETED
    │     │     └─ 失败：status=FAILED + errorMessage
    │     └─ 返回 assessmentId
    │
    ├─ 小程序轮询 GET /api/v1/assessments/:id（每2秒，最多30次）
    │
    ├─ 评估完成后展示指标结果
    │
    ├─ 点击"生成报告" → POST /api/v1/assessments/:id/generate-report
    │     ├─ 生成唯一shareToken（nanoid 16位）
    │     ├─ 渲染HTML报告模板
    │     ├─ Playwright渲染生成PDF上传MinIO
    │     ├─ 生成二维码（指向H5页面URL）
    │     └─ 保存Report记录
    │
    └─ 展示报告预览 + 二维码（学员扫码查看H5）
```

---

## 6. 体态指标计算规格

基于MediaPipe BlazePose 33关键点，计算以下5项核心指标：

| 指标 | 关键点 | 计算方法 | 正常范围 | 异常阈值 |
|------|--------|----------|----------|----------|
| 圆肩角 | 11,12（双肩）, 23,24（双髋） | 双肩连线与垂直线的夹角 | <10° | >15° |
| 头前伸 | 0（鼻）, 11,12（肩）, 耳垂近似点 | 耳垂相对于肩峰的水平距离（cm，通过A4纸校准） | <5cm | >8cm |
| 骨盆前倾 | 23,24（髂前上棘近似）, 11,12躯干参考 | 骨盆平面与垂直面夹角 | 0-10° | >15° |
| 高低肩 | 11,12（双肩峰） | 双肩Y坐标差（像素→cm，A4校准） | <1cm | >2cm |
| 膝超伸 | 23,25,27（髋-膝-踝，侧面） | 膝关节角度（侧面视角） | 170-180° | >180° |

> 校准方案：照片中包含A4纸时，通过A4纸实际宽度（21cm）和像素宽度计算像素-物理尺寸换算比例。

---

## 7. Docker Compose配置

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: posture-postgres
    environment:
      POSTGRES_DB: posture_tracker
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    container_name: posture-minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 5s
      timeout: 5s
      retries: 5

  ai-inference:
    build:
      context: ./services/ai-inference
      dockerfile: Dockerfile
    container_name: posture-ai
    ports:
      - "8000:8000"
    environment:
      - MINIO_ENDPOINT=minio:9000
      - MINIO_ACCESS_KEY=minioadmin
      - MINIO_SECRET_KEY=minioadmin
      - MINIO_SECURE=false
    depends_on:
      minio:
        condition: service_healthy
    volumes:
      - ./services/ai-inference:/app
    restart: unless-stopped

  backend:
    build:
      context: ./services/backend
      dockerfile: Dockerfile
    container_name: posture-backend
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/posture_tracker
      - MINIO_ENDPOINT=minio:9000
      - MINIO_ACCESS_KEY=minioadmin
      - MINIO_SECRET_KEY=minioadmin
      - MINIO_SECURE=false
      - MINIO_BUCKET=posture-tracker
      - AI_SERVICE_URL=http://ai-inference:8000
      - JWT_SECRET=dev-jwt-secret-change-in-production
      - WX_APPID=your_wx_appid
      - WX_SECRET=your_wx_secret
      - WEB_REPORT_URL=http://localhost:3001
    depends_on:
      postgres:
        condition: service_healthy
      minio:
        condition: service_healthy
      ai-inference:
        condition: service_started
    volumes:
      - ./services/backend:/app
      - /app/node_modules
    restart: unless-stopped

  web-report:
    build:
      context: ./apps/web-report
      dockerfile: Dockerfile
    container_name: posture-web-report
    ports:
      - "3001:3000"
    environment:
      - NODE_ENV=development
      - NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
      - NEXT_PUBLIC_MINIO_URL=http://localhost:9000
    depends_on:
      - backend
    volumes:
      - ./apps/web-report:/app
      - /app/node_modules
      - /app/.next
    restart: unless-stopped

volumes:
  postgres_data:
  minio_data:
```

### 7.1 Next.js rewrites配置（可选优化）

> **MVP 阶段说明**：当前 H5 报告端直连后端 API（`NEXT_PUBLIC_API_URL`），通过后端 CORS 放行解决跨域。
> 下面的 rewrites 配置为可选优化，后续若需隐藏后端地址或统一入口再启用。

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://backend:3000/api/v1/:path*',
      },
    ];
  },
};
module.exports = nextConfig;
```

---

## 8. 环境变量(.env.example)

```
# Backend
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/posture_tracker
JWT_SECRET=dev-jwt-secret-change-in-production
PORT=3000

# MinIO
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_SECURE=false
MINIO_BUCKET=posture-tracker

# AI Service
AI_SERVICE_URL=http://localhost:8000

# WeChat Mini Program
WX_APPID=your_wx_appid
WX_SECRET=your_wx_secret

# Web Report
WEB_REPORT_URL=http://localhost:3001

# Python AI
PYTHONUNBUFFERED=1
```

---

## 9. MVP验收标准

M1原型验证完成，满足以下所有条件：

1. ✅ `docker-compose up` 一键启动所有5个服务（postgres/minio/ai/backend/web-report）
2. ✅ 所有健康检查通过：`GET http://localhost:3000/api/v1/health` 返回所有依赖正常
3. ✅ 微信登录可用（开发模式可用mock openid，无需真实AppID）
4. ✅ 可以创建学员
5. ✅ 可以上传正面/侧面照片到MinIO
6. ✅ 提交评估后，AI服务成功检测关键点并计算5项指标
7. ✅ 可以查看评估结果和指标详情
8. ✅ 生成报告成功：H5页面可通过shareToken访问，PDF可下载，二维码可生成
9. ✅ 学员H5报告页在手机浏览器中打开显示正常
10. ✅ 可以查看学员历史评估的改善趋势图
11. ✅ 学员软删除生效：删除后列表不可见，但数据库仍保留
12. ✅ 数据隔离生效：手动修改JWT中的studioId无法访问其他工作室数据

---

## 10. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Windows Docker文件挂载性能慢 | 开发体验差 | 使用WSL2后端；node_modules和.next用匿名卷 |
| Prisma generate在Windows有权限问题 | 启动失败 | Docker镜像构建时预生成Prisma Client，不依赖运行时generate |
| MediaPipe在Docker中无GUI依赖 | 推理失败 | Python镜像使用headless版本的OpenCV/MediaPipe |
| Playwright浏览器体积大 | 镜像大 | 使用Playwright专用精简镜像，只装Chromium |
| 小程序需要HTTPS域名 | 本地开发无法对接 | 开发阶段在小程序后台关闭域名校验；或使用ngrok临时穿透 |
