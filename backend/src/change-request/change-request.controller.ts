import { Controller, Get, Patch, Param, Body, Query, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { writeLog } from '../operation-log/log-helper';
import { promoteWaitlist } from '../waitlist/promote-waitlist';

@Controller('change-requests')
export class ChangeRequestController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async findAll(@Query('status') status?: string, @Query('appointmentId') appointmentId?: string) {
    const where: any = {};
    if (status) where.status = status;
    if (appointmentId) where.appointmentId = appointmentId;

    return this.prisma.changeRequest.findMany({
      where,
      include: {
        appointment: {
          include: {
            patient: { select: { id: true, name: true, phone: true } },
            schedule: {
              include: { doctor: { include: { department: true, user: true } } },
            },
          },
        },
        targetSchedule: {
          include: { doctor: { include: { department: true, user: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Patch(':id/approve')
  async approve(@Param('id') id: string) {
    const cr = await this.prisma.changeRequest.findUniqueOrThrow({
      where: { id },
      include: { appointment: { include: { schedule: true } } },
    });
    if (cr.status !== 'PENDING') throw new BadRequestException('该请求已处理');

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM appointments WHERE id = ${cr.appointmentId} FOR UPDATE`;
      const appointment = await tx.appointment.findUniqueOrThrow({
        where: { id: cr.appointmentId },
        include: { schedule: true },
      });

      if (appointment.status !== 'BOOKED') {
        const statusHint = appointment.status === 'NO_SHOW' ? '已爽约' : '已签到/叫号/接诊中';
        const rejected = await tx.changeRequest.update({
          where: { id },
          data: { status: 'REJECTED', reason: `预约状态已变更（${statusHint}），无法继续操作`, resolvedAt: new Date() },
        });
        await writeLog(tx, { type: 'APPROVE_CHANGE_REQUEST', target: `自动驳回：${cr.type === 'CANCEL' ? '取消' : '改期'}预约${cr.appointmentId}`, role: 'FRONTDESK', result: 'fail', remark: `预约状态已变更（${statusHint}）` });
        return { autoRejected: true, data: rejected };
      }

      if (cr.type === 'CANCEL') {
        await tx.schedule.update({
          where: { id: appointment.scheduleId },
          data: { remaining: { increment: 1 } },
        });
        await promoteWaitlist(tx as any, appointment.scheduleId);
        await tx.appointment.update({
          where: { id: cr.appointmentId },
          data: { status: 'CANCELLED', cancelReason: '超时取消（前台批准）' },
        });
      } else {
        if (!cr.targetScheduleId) throw new BadRequestException('改期请求缺少目标时段');
        await tx.$queryRaw`SELECT id FROM schedules WHERE id = ${cr.targetScheduleId} FOR UPDATE`;
        const target = await tx.schedule.findUniqueOrThrow({ where: { id: cr.targetScheduleId } });
        if (target.suspended) throw new BadRequestException('目标时段已停诊');
        if (target.substituted) throw new BadRequestException('目标时段已替诊');
        if (target.remaining <= 0) throw new BadRequestException('目标时段已满');

        const config = await tx.clinicConfig.findFirst();
        if (config && config.advanceBookingDays > 0) {
          const maxDate = new Date();
          maxDate.setDate(maxDate.getDate() + config.advanceBookingDays);
          maxDate.setHours(23, 59, 59, 999);
          if (target.date > maxDate) {
            throw new BadRequestException(`目标时段超出可预约天数限制（${config.advanceBookingDays}天）`);
          }
        }

        await tx.schedule.update({
          where: { id: appointment.scheduleId },
          data: { remaining: { increment: 1 } },
        });
        await promoteWaitlist(tx as any, appointment.scheduleId);
        await tx.schedule.update({
          where: { id: cr.targetScheduleId },
          data: { remaining: { decrement: 1 } },
        });
        await tx.appointment.update({
          where: { id: cr.appointmentId },
          data: { scheduleId: cr.targetScheduleId },
        });
      }

      const approved = await tx.changeRequest.update({
        where: { id },
        data: { status: 'APPROVED', resolvedAt: new Date() },
      });
      await writeLog(tx, { type: 'APPROVE_CHANGE_REQUEST', target: `审批通过：${cr.type === 'CANCEL' ? '取消' : '改期'}预约${cr.appointmentId}`, role: 'FRONTDESK' });
      return { autoRejected: false, data: approved };
    });

    if (result.autoRejected) {
      throw new BadRequestException('该预约状态已变更，无法批准');
    }
    return result.data;
  }

  @Patch(':id/reject')
  async reject(@Param('id') id: string, @Body() body?: { reason?: string }) {
    const cr = await this.prisma.changeRequest.findUniqueOrThrow({ where: { id } });
    if (cr.status !== 'PENDING') throw new BadRequestException('该请求已处理');

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.changeRequest.update({
        where: { id },
        data: { status: 'REJECTED', reason: body?.reason, resolvedAt: new Date() },
      });
      await writeLog(tx, { type: 'REJECT_CHANGE_REQUEST', target: `审批拒绝：${cr.type === 'CANCEL' ? '取消' : '改期'}预约${cr.appointmentId}`, role: 'FRONTDESK', remark: body?.reason });
      return result;
    });
  }
}
