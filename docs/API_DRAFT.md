# API 规范草案

本文档按统一后端 API 设计，不做微服务端口拆分。

## 基础约定

- Base URL：`/api`
- 返回格式统一。
- 认证使用 `Authorization: Bearer <token>`。
- 时间字段使用 ISO 8601。
- 分页参数使用 `page`、`pageSize`。
- 列表默认按创建时间或业务时间倒序。

## 统一响应结构

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

错误示例：

```json
{
  "code": 40001,
  "message": "预约号源不足",
  "data": null
}
```

## API 分组

```text
/api/auth
/api/users
/api/patients
/api/doctors
/api/departments
/api/schedules
/api/appointment-slots
/api/appointments
/api/checkins
/api/queues
/api/encounters
/api/admin
```

## 患者端

- 注册/登录
- 查看科室和医生
- 选择日期和时段预约
- 查看预约状态
- 取消/改约
- 查看排队进度
- 查看历史就诊记录

相关 API：

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/departments`
- `GET /api/doctors`
- `GET /api/appointment-slots`
- `POST /api/appointments`
- `GET /api/appointments/me`
- `POST /api/appointments/{id}/cancel`
- `POST /api/appointments/{id}/reschedule`
- `GET /api/queues/me`
- `GET /api/encounters/me`

## 医生端

- 查看今日预约列表
- 查看患者信息
- 更新接诊状态
- 填写就诊记录/诊断摘要
- 标记完成/转诊/待复诊

相关 API：

- `GET /api/doctor/appointments/today`
- `GET /api/doctor/patients/{id}`
- `GET /api/doctor/encounters`
- `POST /api/encounters`
- `PATCH /api/encounters/{id}`
- `POST /api/encounters/{id}/complete`

## 前台端

- 到诊签到
- 分配/调整排队顺序
- 叫号
- 过号处理
- 转科/改分诊
- 查看当前候诊队列

相关 API：

- `POST /api/checkins`
- `GET /api/queues`
- `POST /api/queues/{id}/call`
- `POST /api/queues/{id}/skip`
- `POST /api/queues/{id}/transfer`
- `POST /api/queues/{id}/complete`

## 管理后台

- 科室管理
- 排班管理
- 号源配置
- 停诊规则设置
- 预约规则设置

相关 API：

- `POST /api/admin/departments`
- `PATCH /api/admin/departments/{id}`
- `POST /api/admin/doctors`
- `PATCH /api/admin/doctors/{id}`
- `POST /api/admin/schedules`
- `PATCH /api/admin/schedules/{id}`
- `POST /api/admin/appointment-slots`
- `PATCH /api/admin/appointment-slots/{id}`
- `GET /api/admin/appointment-rules`
- `PUT /api/admin/appointment-rules`
