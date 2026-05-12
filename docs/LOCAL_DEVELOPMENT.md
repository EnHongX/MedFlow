# 本地启动方式

## 该不该做

该做，当前已经固定本地目录和端口。

## 为什么

本地启动方式要服务于快速开发，不应该一开始就依赖复杂部署环境。

## 怎么做

## 目录

```text
backend/              # NestJS API
apps/
  patient-web/        # 患者端
  doctor-web/         # 医生端
  frontdesk-web/      # 前台端
  admin-web/          # 管理后台
docs/
```

## 端口

| 应用 | 端口 |
| --- | --- |
| 后端 API | `5100` |
| 患者端 | `5110` |
| 医生端 | `5120` |
| 前台端 | `5130` |
| 管理后台 | `5140` |
| PostgreSQL | `5432` |

## 环境变量建议

后端 `.env`：

```env
DATABASE_URL="postgresql://medflow:medflow@localhost:5432/medflow?schema=public"
JWT_SECRET="change-me"
PORT=5100
```

## 安装依赖

```bash
npm install
```

## 启动顺序

1. 启动 PostgreSQL。
2. 启动后端 `backend/`。
3. 启动需要开发的前端应用。

## 启动命令

后端：

```bash
npm run dev:backend
```

患者端：

```bash
npm run dev:patient
```

医生端：

```bash
npm run dev:doctor
```

前台端：

```bash
npm run dev:frontdesk
```

管理后台：

```bash
npm run dev:admin
```

## Prisma

生成 Prisma Client：

```bash
npm --workspace backend run prisma:generate
```

创建迁移：

```bash
npm --workspace backend run prisma:migrate
```
