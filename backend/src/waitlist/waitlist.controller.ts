import { Controller, Get, Post, Patch, Body, Param, Query, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { writeLog } from '../operation-log/log-helper';

@Controller('waitlist')
export class WaitlistController {
  constructor(private prisma: PrismaService) {}

  @Post()
  async join(@Body() body: { patientId: string; scheduleId: string }) {
    if (!body.patientId || !body.scheduleId) {
      throw new BadRequestException('patientId 和 scheduleId 不能为空');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(2027)`;

      const schedule = await tx.schedule.findUniqueOrThrow({ where: { id: body.scheduleId } });
      if (schedule.suspended) throw new BadRequestException('该排班已停诊，无法候补');
      if (schedule.substituted) throw new BadRequestException('该排班已替诊，无法候补');
      if (schedule.remaining > 0) throw new BadRequestException('该排班仍有号源，请直接预约');

      const existingAppointment = await tx.appointment.findFirst({
        where: {
          patientId: body.patientId,
          scheduleId: body.scheduleId,
          status: { in: ['BOOKED', 'CHECKED_IN', 'CALLED', 'IN_PROGRESS'] },
        },
      });
      if (existingAppointment) throw new BadRequestException('您在该时段已有有效预约，无需候补');

      const existingWaitlist = await tx.waitlistEntry.findFirst({
        where: { patientId: body.patientId, scheduleId: body.scheduleId, status: 'PENDING' },
      });
      if (existingWaitlist) throw new BadRequestException('您已在该时段候补队列中');

      const lastEntry = await tx.waitlistEntry.findFirst({
        where: { scheduleId: body.scheduleId },
        orderBy: { position: 'desc' },
      });
      const position = (lastEntry?.position ?? 0) + 1;

      const entry = await tx.waitlistEntry.create({
        data: {
          patientId: body.patientId,
          scheduleId: body.scheduleId,
          position,
        },
      });

      await writeLog(tx as any, {
        type: 'WAITLIST_JOIN',
        target: `候补：患者${body.patientId} -> 排班${body.scheduleId} 位置${position}`,
        role: 'PATIENT',
      });

      return entry;
    });
  }

  @Get()
  findAll(
    @Query('scheduleId') scheduleId?: string,
    @Query('patientId') patientId?: string,
    @Query('status') status?: string,
  ) {
    const where: any = {};
    if (scheduleId) where.scheduleId = scheduleId;
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;

    return this.prisma.waitlistEntry.findMany({
      where,
      orderBy: { position: 'asc' },
      include: {
        patient: { select: { id: true, name: true, phone: true } },
        schedule: {
          include: { doctor: { include: { user: { select: { name: true } }, department: true } } },
        },
      },
    });
  }

  @Patch(':id/cancel')
  async cancel(@Param('id') id: string) {
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.waitlistEntry.findUniqueOrThrow({ where: { id } });
      if (entry.status !== 'PENDING') throw new BadRequestException('只有候补中的记录才能取消');

      const cancelled = await tx.waitlistEntry.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      await writeLog(tx as any, {
        type: 'WAITLIST_CANCEL',
        target: `取消候补：${id}`,
        role: 'PATIENT',
      });

      return cancelled;
    });
  }
}
