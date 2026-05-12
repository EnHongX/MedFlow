# 数据模型草案

本文档定义 PostgreSQL + Prisma 方向下的核心实体草案，不包含完整字段细节。

## 核心实体

| 实体 | 说明 |
| --- | --- |
| `User` | 系统用户，包含患者、医生、前台、管理员 |
| `Role` | 角色定义 |
| `Department` | 科室 |
| `ClinicRoom` | 诊室 |
| `DoctorProfile` | 医生资料 |
| `PatientProfile` | 患者资料 |
| `Schedule` | 医生排班 |
| `SlotInventory` | 时段号源库存 |
| `AppointmentRule` | 预约规则，如提前预约天数、取消截止时间 |
| `Appointment` | 预约单 |
| `CheckIn` | 到诊签到记录 |
| `QueueTicket` | 候诊队列号 |
| `Encounter` | 接诊记录 |
| `Notification` | 通知记录 |
| `AuditLog` | 关键操作审计记录 |

## 建议数据表

| 表 | 说明 |
| --- | --- |
| `users` | 登录账号 |
| `roles` | 角色 |
| `user_roles` | 用户与角色关系 |
| `patients` | 患者资料 |
| `doctors` | 医生资料 |
| `departments` | 科室 |
| `clinic_rooms` | 诊室 |
| `schedules` | 医生排班 |
| `appointment_slots` | 预约号源时段 |
| `appointment_rules` | 预约规则 |
| `appointments` | 预约单 |
| `checkins` | 到诊签到 |
| `queue_tickets` | 候诊队列 |
| `encounters` | 接诊记录 |
| `operation_logs` | 操作日志 |

## Prisma 命名建议

- Prisma Model 使用 PascalCase，如 `AppointmentSlot`。
- PostgreSQL 表名使用 snake_case，如 `appointment_slots`。
- 主键统一使用 `id`。
- 时间字段统一使用 `created_at`、`updated_at`。
- 软删除如有必要再加 `deleted_at`，MVP 阶段默认不加。

## 关键状态

### 预约状态

- `PENDING`
- `CONFIRMED`
- `CHECKED_IN`
- `IN_QUEUE`
- `IN_CONSULTATION`
- `COMPLETED`
- `CANCELLED`
- `NO_SHOW`

说明：

- `PENDING` 只用于需要异步确认或锁号中的场景。
- 如果 MVP 采用同步扣减号源，创建成功后可直接进入 `CONFIRMED`。
- 取消和改期必须记录原因、操作人和时间。

### 队列状态

- `WAITING`
- `CALLED`
- `SKIPPED`
- `TRANSFERRED`
- `DONE`

### 接诊状态

- `OPEN`
- `COMPLETED`
- `REFERRED`
- `FOLLOW_UP_REQUIRED`

## 需要重点保证

- 预约创建和号源扣减必须具备一致性。
- 取消、改期、停诊需要明确释放或迁移号源。
- 到诊、过号、转科不能破坏队列顺序。
- 接诊状态要能反向更新预约主链路状态。
- 前台、医生、管理员的关键操作需要保留审计线索。
- 患者个人信息和就诊摘要需要按最小可见原则控制访问。
