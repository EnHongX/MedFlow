# 架构说明

## 系统定位

MedFlow 是门诊预约与分诊协同系统，第一阶段按 4 个使用端组织项目。

当前不做服务端口拆分，不按微服务设计。先把患者、医生、前台、管理员四类使用场景梳理清楚。

## 端划分

| 应用 | 目录 | 使用者 | 核心职责 |
| --- | --- | --- | --- |
| 患者端 | `apps/patient-web` | 患者 | 预约、取消、改约、查看状态和排队进度 |
| 医生端 | `apps/doctor-web` | 医生 | 查看预约、接诊、查看病人记录 |
| 前台端 | `apps/frontdesk-web` | 前台/导诊台 | 到诊、叫号、分诊、过号处理 |
| 管理后台 | `apps/admin-web` | 管理员 | 科室、排班、号源、规则维护 |

## 核心流程

```text
患者端
  -> 创建预约
  -> 前台端
  -> 到诊/分诊/叫号
  -> 医生端
  -> 接诊/记录
  -> 管理后台维护基础规则
```

## 技术架构

```text
apps/patient-web
apps/doctor-web
apps/frontdesk-web
apps/admin-web
        |
        v
backend/ NestJS API
        |
        v
Prisma
        |
        v
PostgreSQL
```

## 技术选型

| 层 | 技术 |
| --- | --- |
| 后端运行时 | `Node.js` |
| 后端语言 | `TypeScript` |
| 后端框架 | `NestJS` |
| ORM | `Prisma` |
| 数据库 | `PostgreSQL` |
| 前端框架 | `Vue 3` |
| 前端构建 | `Vite` |
| 前端语言 | `TypeScript` |
| UI 组件 | `Element Plus` |

## 工程原则

- MVP 阶段优先保证 4 个端的业务闭环。
- 不提前拆服务端口，不做微服务治理。
- 后端先作为统一 NestJS API 看待，不拆微服务。
- 预约、号源、到诊、叫号、接诊是核心主链路。
- 通知、统计、复杂审计不阻塞 MVP。
