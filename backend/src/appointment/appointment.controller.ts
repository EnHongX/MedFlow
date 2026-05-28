import { Controller, Get, Post, Patch, Body, Param, Query, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { writeLog } from '../operation-log/log-helper';
import { promoteWaitlist } from '../waitlist/promote-waitlist';

@Controller('appointments')
export class AppointmentController {
  constructor(private prisma: PrismaService) {}

  @Get()
  findAll(@Query('date') date?: string, @Query('scheduleId') scheduleId?: string, @Query('status') status?: string, @Query('patientId') patientId?: string) {
    const where: Record<string, unknown> = {};
    if (scheduleId) where.scheduleId = scheduleId;
    if (status) where.status = status;
    if (patientId) where.patientId = patientId;
    if (date) {
      where.schedule = { date: new Date(date) };
    }
    return this.prisma.appointment.findMany({
      where,
      include: {
        patient: { select: { id: true, name: true, phone: true } },
        schedule: { include: { doctor: { include: { user: { select: { name: true } }, department: true } } } },
        queueEntry: { include: { skipLogs: { orderBy: { skippedAt: 'asc' } } } },
        visitRecord: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Post()
  async create(@Body() body: { patientId: string; scheduleId: string }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM schedules WHERE id = ${body.scheduleId} FOR UPDATE`;
      const schedule = await tx.schedule.findUniqueOrThrow({ where: { id: body.scheduleId } });
      if (schedule.suspended) {
        throw new BadRequestException('该排班已停诊，无法预约');
      }
      if (schedule.substituted) {
        throw new BadRequestException('该排班已替诊，无法预约');
      }
      if (schedule.remaining <= 0) {
        throw new BadRequestException('号源不足，无法预约');
      }

      const config = await tx.clinicConfig.findFirst();
      if (config && config.advanceBookingDays > 0) {
        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + config.advanceBookingDays);
        maxDate.setHours(23, 59, 59, 999);
        if (schedule.date > maxDate) {
          throw new BadRequestException(`只能预约${config.advanceBookingDays}天内的号源`);
        }
      }

      await tx.schedule.update({
        where: { id: body.scheduleId },
        data: { remaining: { decrement: 1 } },
      });
      const appointment = await tx.appointment.create({
        data: { patientId: body.patientId, scheduleId: body.scheduleId, status: 'BOOKED' },
        include: {
          patient: { select: { id: true, name: true, phone: true } },
          schedule: { include: { doctor: { include: { user: { select: { name: true } } } } } },
        },
      });
      await writeLog(tx, { type: 'CREATE_APPOINTMENT', target: `预约：${appointment.patient.name} -> ${appointment.schedule.doctor.user.name}`, role: 'PATIENT' });
      return appointment;
    });
  }

  @Patch(':id/cancel')
  async cancel(@Param('id') id: string, @Body() body?: { reason?: string; force?: boolean }) {
    return this.prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUniqueOrThrow({
        where: { id },
        include: { schedule: true, queueEntry: true },
      });

      if (body?.force) {
        if (appointment.status === 'BOOKED') {
          await tx.schedule.update({
            where: { id: appointment.scheduleId },
            data: { remaining: { increment: 1 } },
          });
          await promoteWaitlist(tx as any, appointment.scheduleId);
        }
        if (appointment.queueEntry && appointment.queueEntry.status !== 'COMPLETED') {
          await tx.queueEntry.update({
            where: { id: appointment.queueEntry.id },
            data: { status: 'COMPLETED', completedAt: new Date() },
          });
        }
        const cancelled = await tx.appointment.update({
          where: { id },
          data: { status: 'CANCELLED', cancelReason: body.reason || '前台取消' },
        });
        await writeLog(tx, { type: 'CANCEL_APPOINTMENT', target: `取消预约：${id}`, role: 'FRONTDESK', remark: body.reason });
        return cancelled;
      }

      if (appointment.status !== 'BOOKED') {
        throw new BadRequestException('只有已预约状态才能自助取消');
      }

      const config = await tx.clinicConfig.findFirst();
      if (config && config.cancelDeadlineHours > 0) {
        const appointmentTime = new Date(
          appointment.schedule.date.toISOString().slice(0, 10) + 'T' + appointment.schedule.startTime + ':00',
        );
        const deadlineMs = config.cancelDeadlineHours * 60 * 60 * 1000;
        if (appointmentTime.getTime() - Date.now() < deadlineMs) {
          const existing = await tx.changeRequest.findFirst({
            where: { appointmentId: id, type: 'CANCEL', status: 'PENDING' },
          });
          if (existing) {
            return { blocked: true, message: '已提交取消申请，等待前台审批', changeRequestId: existing.id };
          }
          const cr = await tx.changeRequest.create({
            data: { appointmentId: id, type: 'CANCEL' },
          });
          await writeLog(tx, { type: 'CANCEL_APPOINTMENT', target: `取消预约（需审批）：${id}`, role: 'PATIENT', result: 'blocked', remark: `距就诊不足${config.cancelDeadlineHours}小时，转前台审批` });
          return { blocked: true, message: `距就诊时间不足${config.cancelDeadlineHours}小时，已提交前台审批`, changeRequestId: cr.id };
        }
      }

      await tx.schedule.update({
        where: { id: appointment.scheduleId },
        data: { remaining: { increment: 1 } },
      });
      await promoteWaitlist(tx as any, appointment.scheduleId);
      const cancelled = await tx.appointment.update({
        where: { id },
        data: { status: 'CANCELLED', cancelReason: body?.reason },
      });
      await writeLog(tx, { type: 'CANCEL_APPOINTMENT', target: `取消预约：${id}`, role: 'PATIENT', remark: body?.reason });
      return cancelled;
    });
  }

  @Patch(':id/reschedule')
  async reschedule(@Param('id') id: string, @Body() body: { targetScheduleId: string }) {
    return this.prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUniqueOrThrow({
        where: { id },
        include: { schedule: true },
      });

      if (appointment.status !== 'BOOKED') {
        throw new BadRequestException('只有已预约状态才能改期');
      }
      if (appointment.scheduleId === body.targetScheduleId) {
        throw new BadRequestException('不能改期到相同时段');
      }

      const config = await tx.clinicConfig.findFirst();

      if (config && config.cancelDeadlineHours > 0) {
        const appointmentTime = new Date(
          appointment.schedule.date.toISOString().slice(0, 10) + 'T' + appointment.schedule.startTime + ':00',
        );
        const deadlineMs = config.cancelDeadlineHours * 60 * 60 * 1000;
        if (appointmentTime.getTime() - Date.now() < deadlineMs) {
          const existing = await tx.changeRequest.findFirst({
            where: { appointmentId: id, type: 'RESCHEDULE', status: 'PENDING' },
          });
          if (existing) {
            return { blocked: true, message: '已提交改期申请，等待前台审批', changeRequestId: existing.id };
          }
          const cr = await tx.changeRequest.create({
            data: { appointmentId: id, type: 'RESCHEDULE', targetScheduleId: body.targetScheduleId },
          });
          await writeLog(tx, { type: 'RESCHEDULE_APPOINTMENT', target: `改期（需审批）：${id} -> ${body.targetScheduleId}`, role: 'PATIENT', result: 'blocked', remark: `距就诊不足${config.cancelDeadlineHours}小时，转前台审批` });
          return { blocked: true, message: `距就诊时间不足${config.cancelDeadlineHours}小时，已提交前台审批`, changeRequestId: cr.id };
        }
      }

      await tx.$queryRaw`SELECT id FROM schedules WHERE id = ${body.targetScheduleId} FOR UPDATE`;
      const target = await tx.schedule.findUniqueOrThrow({ where: { id: body.targetScheduleId } });
      if (target.suspended) throw new BadRequestException('目标时段已停诊');
      if (target.substituted) throw new BadRequestException('目标时段已替诊');
      if (target.remaining <= 0) throw new BadRequestException('目标时段号源已满');

      if (config && config.advanceBookingDays > 0) {
        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + config.advanceBookingDays);
        maxDate.setHours(23, 59, 59, 999);
        if (target.date > maxDate) {
          throw new BadRequestException(`只能改期到${config.advanceBookingDays}天内的号源`);
        }
      }

      await tx.schedule.update({
        where: { id: appointment.scheduleId },
        data: { remaining: { increment: 1 } },
      });
      await promoteWaitlist(tx as any, appointment.scheduleId);
      await tx.schedule.update({
        where: { id: body.targetScheduleId },
        data: { remaining: { decrement: 1 } },
      });
      const rescheduled = await tx.appointment.update({
        where: { id },
        data: { scheduleId: body.targetScheduleId },
        include: {
          schedule: { include: { doctor: { include: { user: { select: { name: true } }, department: true } } } },
        },
      });
      await writeLog(tx, { type: 'RESCHEDULE_APPOINTMENT', target: `改期：${id} -> ${body.targetScheduleId}`, role: 'PATIENT' });
      return rescheduled;
    });
  }

  @Patch(':id/start')
  async start(@Param('id') id: string) {
    return this.prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUniqueOrThrow({
        where: { id },
        include: { queueEntry: true },
      });
      if (!appointment.queueEntry || appointment.queueEntry.status !== 'CALLED') {
        throw new BadRequestException('只有已叫号的患者才能开始接诊');
      }
      await tx.queueEntry.update({
        where: { id: appointment.queueEntry.id },
        data: { status: 'IN_PROGRESS' },
      });
      const started = await tx.appointment.update({
        where: { id },
        data: { status: 'IN_PROGRESS' },
        include: { queueEntry: { include: { skipLogs: true } } },
      });
      await writeLog(tx, { type: 'START_APPOINTMENT', target: `开始接诊：${id}`, role: 'DOCTOR' });
      return started;
    });
  }

  @Patch(':id/complete')
  async complete(@Param('id') id: string, @Body() body: {
    doctorId: string;
    chiefComplaint: string;
    diagnosis: string;
    treatmentPlan: string;
    followUpRecommended?: boolean;
    followUpDeptId?: string;
    followUpDoctorId?: string;
    followUpDateStart?: string;
    followUpDateEnd?: string;
  }) {
    if (!body?.doctorId) {
      throw new BadRequestException('缺少医生标识');
    }
    if (!body?.chiefComplaint?.trim() || !body?.diagnosis?.trim() || !body?.treatmentPlan?.trim()) {
      throw new BadRequestException('就诊记录必填字段不能为空：主诉、诊断结论、处理意见');
    }
    if (body.followUpRecommended && !body.followUpDeptId && !body.followUpDoctorId) {
      throw new BadRequestException('建议复诊时须指定推荐科室或医生');
    }

    return this.prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUniqueOrThrow({
        where: { id },
        include: { queueEntry: true, visitRecord: true, schedule: true },
      });
      if (appointment.schedule.doctorId !== body.doctorId) {
        throw new BadRequestException('只能完成本人名下正在接诊的患者');
      }
      if (!appointment.queueEntry || appointment.queueEntry.status !== 'IN_PROGRESS') {
        throw new BadRequestException('只有正在接诊的患者才能完成接诊');
      }
      if (appointment.visitRecord) {
        throw new BadRequestException('该预约已存在就诊记录，不可重复提交');
      }

      await tx.visitRecord.create({
        data: {
          appointmentId: id,
          chiefComplaint: body.chiefComplaint.trim(),
          diagnosis: body.diagnosis.trim(),
          treatmentPlan: body.treatmentPlan.trim(),
          followUpRecommended: body.followUpRecommended || false,
          followUpDeptId: body.followUpDeptId || null,
          followUpDoctorId: body.followUpDoctorId || null,
          followUpDateStart: body.followUpDateStart ? new Date(body.followUpDateStart) : null,
          followUpDateEnd: body.followUpDateEnd ? new Date(body.followUpDateEnd) : null,
        },
      });

      await tx.queueEntry.updateMany({
        where: { appointmentId: id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      const completed = await tx.appointment.update({
        where: { id },
        data: { status: 'COMPLETED' },
        include: { queueEntry: { include: { skipLogs: true } }, visitRecord: true },
      });
      await writeLog(tx, { type: 'CREATE_VISIT_RECORD', target: `创建就诊记录：${id}`, role: 'DOCTOR' });
      await writeLog(tx, { type: 'COMPLETE_APPOINTMENT', target: `完成接诊：${id}`, role: 'DOCTOR' });
      return completed;
    });
  }

  @Patch(':id/mark-no-show')
  async markNoShow(@Param('id') id: string) {
    return this.prisma.$transaction(async (tx) => {
      // Acquire row lock to serialize against concurrent cancel/check-in/reschedule
      await tx.$executeRaw`SELECT id FROM appointments WHERE id = ${id} FOR UPDATE`;

      const appointment = await tx.appointment.findUnique({
        where: { id },
        include: { schedule: true, patient: { select: { name: true } } },
      });
      if (!appointment) {
        throw new BadRequestException('预约不存在');
      }
      if (appointment.status !== 'BOOKED') {
        throw new BadRequestException('只有已预约状态才能标记爽约');
      }

      const config = await tx.clinicConfig.findFirst();
      const noShowThreshold = config?.noShowThresholdMinutes ?? 30;

      const dateStr = appointment.schedule.date.toISOString().slice(0, 10);
      const startTime = new Date(`${dateStr}T${appointment.schedule.startTime}:00`);
      const elapsedMinutes = (Date.now() - startTime.getTime()) / 60000;

      if (elapsedMinutes < noShowThreshold) {
        throw new BadRequestException(
          `未到爽约时间，需等待${noShowThreshold}分钟（当前已过${Math.floor(elapsedMinutes)}分钟）`,
        );
      }

      // Release the slot
      await tx.schedule.update({
        where: { id: appointment.scheduleId },
        data: { remaining: { increment: 1 } },
      });

      // Promote waitlist
      await promoteWaitlist(tx, appointment.scheduleId);

      // Update appointment status
      await tx.appointment.update({
        where: { id },
        data: { status: 'NO_SHOW' },
      });

      await writeLog(tx, {
        type: 'MARK_NO_SHOW',
        target: `标记爽约：${appointment.patient.name}（${dateStr} ${appointment.schedule.startTime}）`,
        role: 'FRONTDESK',
        remark: '号源已释放，候补补位已触发',
      });

      return { success: true };
    });
  }
}
