import { Controller, Get, Post, Patch, Body, Param, Query, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { writeLog } from '../operation-log/log-helper';
import { promoteWaitlist } from '../waitlist/promote-waitlist';

@Controller('schedules')
export class ScheduleController {
  constructor(private prisma: PrismaService) {}

  @Get()
  findAll(
    @Query('doctorId') doctorId?: string,
    @Query('date') date?: string,
    @Query('departmentId') departmentId?: string,
    @Query('dateStart') dateStart?: string,
    @Query('dateEnd') dateEnd?: string,
  ) {
    const where: Record<string, unknown> = {};
    if (doctorId) where.doctorId = doctorId;
    if (departmentId) where.doctor = { departmentId };
    if (date) {
      where.date = new Date(date);
    } else if (dateStart || dateEnd) {
      const dateFilter: Record<string, Date> = {};
      if (dateStart) dateFilter.gte = new Date(dateStart);
      if (dateEnd) dateFilter.lte = new Date(dateEnd);
      where.date = dateFilter;
    }
    return this.prisma.schedule.findMany({
      where,
      include: { doctor: { include: { user: { select: { name: true } }, department: true } } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
  }

  @Post()
  async create(@Body() body: { doctorId: string; date: string; startTime: string; endTime: string; total: number }) {
    return this.prisma.$transaction(async (tx) => {
      const schedule = await tx.schedule.create({
        data: {
          doctorId: body.doctorId,
          date: new Date(body.date),
          startTime: body.startTime,
          endTime: body.endTime,
          total: body.total,
          remaining: body.total,
        },
      });
      await writeLog(tx, { type: 'CREATE_SCHEDULE', target: `排班：${body.date} ${body.startTime}-${body.endTime}`, role: 'ADMIN' });
      return schedule;
    });
  }

  @Patch(':id/suspend')
  async suspend(@Param('id') id: string, @Body() body: { reason: string }) {
    try {
      if (!body.reason?.trim()) {
        throw new BadRequestException('停诊原因不能为空');
      }

      return await this.prisma.$transaction(async (tx) => {
        const schedule = await tx.schedule.findUniqueOrThrow({ where: { id } });
        if (schedule.suspended) {
          throw new BadRequestException('该排班已停诊，不能重复操作');
        }

        const reason = `医生临时停诊：${body.reason.trim()}`;

        await tx.schedule.update({
          where: { id },
          data: {
            suspended: true,
            suspendReason: body.reason.trim(),
            suspendedAt: new Date(),
            remaining: 0,
          },
        });

        await tx.appointment.updateMany({
          where: { scheduleId: id, status: 'BOOKED' },
          data: { status: 'CANCELLED', cancelReason: reason },
        });

        await tx.waitlistEntry.updateMany({
          where: { scheduleId: id, status: 'PENDING' },
          data: { status: 'CLOSED', closeReason: reason },
        });

        await tx.appointment.updateMany({
          where: { scheduleId: id, status: { in: ['CHECKED_IN', 'IN_PROGRESS'] } },
          data: { status: 'PENDING_FRONTDESK', cancelReason: reason },
        });

        const pendingAppointments = await tx.appointment.findMany({
          where: { scheduleId: id, status: 'PENDING_FRONTDESK' },
          select: { id: true },
        });
        if (pendingAppointments.length > 0) {
          await tx.queueEntry.updateMany({
            where: {
              appointmentId: { in: pendingAppointments.map((a) => a.id) },
              status: { in: ['WAITING', 'IN_PROGRESS'] },
            },
            data: { status: 'COMPLETED', completedAt: new Date() },
          });
        }

        await writeLog(tx, { type: 'SUSPEND_SCHEDULE', target: `停诊：${schedule.date.toISOString().slice(0, 10)} ${schedule.startTime}`, role: 'ADMIN', remark: body.reason.trim() });
        return { success: true, message: '停诊操作已完成' };
      });
    } catch (e: any) {
      if (e instanceof BadRequestException) {
        await writeLog(this.prisma, { type: 'SUSPEND_SCHEDULE', target: `停诊：排班${id}`, role: 'ADMIN', result: 'fail', remark: e.message });
      }
      throw e;
    }
  }

  @Patch(':id/substitute')
  async substitute(@Param('id') id: string, @Body() body: { targetScheduleId: string; reason?: string }) {
    if (!body.targetScheduleId) throw new BadRequestException('请选择目标排班');
    if (id === body.targetScheduleId) throw new BadRequestException('不能替诊到同一排班');

    try {
      return await this.prisma.$transaction(async (tx) => {
        const [lockFirst, lockSecond] = [id, body.targetScheduleId].sort();
        await tx.$queryRawUnsafe(`SELECT id FROM schedules WHERE id = '${lockFirst}' FOR UPDATE`);
        await tx.$queryRawUnsafe(`SELECT id FROM schedules WHERE id = '${lockSecond}' FOR UPDATE`);

        const source = await tx.schedule.findUniqueOrThrow({
          where: { id },
          include: { doctor: { include: { user: { select: { name: true } }, department: true } } },
        });

        if (source.suspended) throw new BadRequestException('该排班已停诊，不能替诊');
        if (source.substituted) throw new BadRequestException('该排班已替诊，不能重复操作');

        const target = await tx.schedule.findUniqueOrThrow({
          where: { id: body.targetScheduleId },
          include: { doctor: { include: { user: { select: { name: true } }, department: true } } },
        });

        if (source.doctor.departmentId !== target.doctor.departmentId) {
          throw new BadRequestException('替诊医生必须属于同一科室');
        }
        if (target.suspended) throw new BadRequestException('目标排班已停诊');
        if (target.substituted) throw new BadRequestException('目标排班已被替诊占用');

        const bookedAppointments = await tx.appointment.findMany({
          where: { scheduleId: id, status: 'BOOKED' },
          orderBy: { createdAt: 'asc' },
          select: { id: true, patientId: true },
        });

        const existingTargetAppointments = await tx.appointment.findMany({
          where: {
            scheduleId: body.targetScheduleId,
            status: { in: ['BOOKED', 'CHECKED_IN', 'CALLED', 'IN_PROGRESS'] },
          },
          select: { patientId: true },
        });
        const targetPatientIds = new Set(existingTargetAppointments.map((a) => a.patientId));

        const toTransfer = bookedAppointments.filter((a) => !targetPatientIds.has(a.patientId));
        const toSkip = bookedAppointments.filter((a) => targetPatientIds.has(a.patientId));
        const transferCount = toTransfer.length;

        if (target.remaining < transferCount) {
          throw new BadRequestException(
            `目标排班剩余号源(${target.remaining})不足以容纳所有待转移预约(${transferCount})，替诊操作中止`,
          );
        }

        const reasonText = body.reason?.trim()
          ? `替诊：原${source.doctor.user.name}医生因${body.reason.trim()}，由${target.doctor.user.name}医生替诊`
          : `替诊：原${source.doctor.user.name}医生临时变更，由${target.doctor.user.name}医生替诊`;

        if (transferCount > 0) {
          await tx.appointment.updateMany({
            where: { id: { in: toTransfer.map((a) => a.id) } },
            data: { scheduleId: body.targetScheduleId, transferReason: reasonText },
          });
          await tx.schedule.update({
            where: { id: body.targetScheduleId },
            data: { remaining: { decrement: transferCount } },
          });
        }

        if (toSkip.length > 0) {
          await tx.appointment.updateMany({
            where: { id: { in: toSkip.map((a) => a.id) } },
            data: { status: 'CANCELLED', cancelReason: `${reasonText}（患者在目标排班已有有效预约，自动取消重复占位）` },
          });
        }

        const activeAppointments = await tx.appointment.findMany({
          where: { scheduleId: id, status: { in: ['CHECKED_IN', 'CALLED', 'IN_PROGRESS'] } },
          select: { id: true },
        });
        let pendingCount = 0;
        if (activeAppointments.length > 0) {
          await tx.appointment.updateMany({
            where: { scheduleId: id, status: { in: ['CHECKED_IN', 'CALLED', 'IN_PROGRESS'] } },
            data: { status: 'PENDING_FRONTDESK', cancelReason: reasonText },
          });
          pendingCount = activeAppointments.length;
          await tx.queueEntry.updateMany({
            where: {
              appointmentId: { in: activeAppointments.map((a) => a.id) },
              status: { in: ['WAITING', 'CALLED', 'IN_PROGRESS'] },
            },
            data: { status: 'COMPLETED', completedAt: new Date() },
          });
        }

        const pendingWaitlist = await tx.waitlistEntry.findMany({
          where: { scheduleId: id, status: 'PENDING' },
          orderBy: { position: 'asc' },
        });

        const existingTargetWaitlist = await tx.waitlistEntry.findMany({
          where: { scheduleId: body.targetScheduleId, status: 'PENDING' },
          select: { patientId: true },
        });
        const targetWaitlistPatientIds = new Set(existingTargetWaitlist.map((e) => e.patientId));

        const allTargetPatientIds = new Set([...targetPatientIds]);
        toTransfer.forEach((a) => allTargetPatientIds.add(a.patientId));

        let waitlistMoved = 0;
        let waitlistSkipped = 0;
        if (pendingWaitlist.length > 0) {
          const lastTargetEntry = await tx.waitlistEntry.findFirst({
            where: { scheduleId: body.targetScheduleId },
            orderBy: { position: 'desc' },
          });
          let nextPosition = (lastTargetEntry?.position ?? 0) + 1;
          for (const entry of pendingWaitlist) {
            if (allTargetPatientIds.has(entry.patientId) || targetWaitlistPatientIds.has(entry.patientId)) {
              await tx.waitlistEntry.update({
                where: { id: entry.id },
                data: { status: 'CLOSED', closeReason: `${reasonText}（患者在目标排班已有有效预约或候补，自动关闭重复记录）` },
              });
              waitlistSkipped++;
            } else {
              await tx.waitlistEntry.update({
                where: { id: entry.id },
                data: { scheduleId: body.targetScheduleId, position: nextPosition },
              });
              targetWaitlistPatientIds.add(entry.patientId);
              nextPosition++;
              waitlistMoved++;
            }
          }
        }

        await tx.schedule.update({
          where: { id },
          data: {
            substituted: true,
            substituteReason: body.reason?.trim() || null,
            substitutedAt: new Date(),
            substitutedToId: body.targetScheduleId,
            remaining: 0,
          },
        });

        await promoteWaitlist(tx as any, body.targetScheduleId);

        await writeLog(tx, {
          type: 'SUBSTITUTE_SCHEDULE',
          target: `替诊：${source.doctor.user.name}(${source.date.toISOString().slice(0, 10)} ${source.startTime}) → ${target.doctor.user.name}(${target.date.toISOString().slice(0, 10)} ${target.startTime})`,
          role: 'ADMIN',
          remark: `转移${transferCount}个预约，${waitlistMoved}个候补，${pendingCount}个待前台处理，去重取消${toSkip.length}个预约、关闭${waitlistSkipped}个候补${body.reason?.trim() ? '，原因：' + body.reason.trim() : ''}`,
        });

        return { success: true, message: '替诊操作已完成', transferred: transferCount, waitlistMoved, pendingFrontdesk: pendingCount };
      });
    } catch (e: any) {
      if (e instanceof BadRequestException) {
        await writeLog(this.prisma, { type: 'SUBSTITUTE_SCHEDULE', target: `替诊：排班${id} → ${body.targetScheduleId}`, role: 'ADMIN', result: 'fail', remark: e.message });
      }
      throw e;
    }
  }
}
