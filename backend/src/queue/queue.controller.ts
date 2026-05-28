import { Controller, Get, Post, Patch, Body, Param, Query, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { writeLog } from '../operation-log/log-helper';

@Controller('queue')
export class QueueController {
  constructor(private prisma: PrismaService) {}

  @Get()
  findAll(@Query('doctorId') doctorId?: string, @Query('status') status?: string) {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (doctorId) {
      where.appointment = { schedule: { doctorId, suspended: false } };
    } else {
      where.appointment = { schedule: { suspended: false } };
    }
    return this.prisma.queueEntry.findMany({
      where,
      include: {
        appointment: {
          include: {
            patient: { select: { id: true, name: true, phone: true } },
            schedule: { include: { doctor: { include: { user: { select: { name: true } }, department: true } } } },
          },
        },
        skipLogs: { orderBy: { skippedAt: 'asc' } },
      },
      orderBy: { queueNumber: 'asc' },
    });
  }

  private async nextQueueNumber(tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0]) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Advisory lock serializes queue number assignment to prevent duplicates
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(2026)`;

    const lastEntry = await tx.queueEntry.findFirst({
      where: { createdAt: { gte: today, lt: tomorrow } },
      orderBy: { queueNumber: 'desc' },
    });
    return (lastEntry?.queueNumber ?? 0) + 1;
  }

  @Post('checkin')
  async checkin(@Body() body: { appointmentId: string }) {
    return this.prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUniqueOrThrow({
        where: { id: body.appointmentId },
        include: { queueEntry: true, schedule: true },
      });

      if (appointment.schedule.suspended) {
        throw new BadRequestException('该排班已停诊，无法签到');
      }
      if (appointment.status === 'NO_SHOW') {
        throw new BadRequestException('该预约已爽约，无法签到');
      }
      if (appointment.queueEntry) {
        throw new BadRequestException('该预约已签到，不能重复签到');
      }
      if (appointment.status !== 'BOOKED') {
        throw new BadRequestException('只有已预约状态才能签到');
      }

      const queueNumber = await this.nextQueueNumber(tx);

      await tx.appointment.update({
        where: { id: body.appointmentId },
        data: { status: 'CHECKED_IN' },
      });

      return tx.queueEntry.create({
        data: { appointmentId: body.appointmentId, queueNumber },
        include: {
          appointment: {
            include: {
              patient: { select: { id: true, name: true, phone: true } },
              schedule: { include: { doctor: { include: { user: { select: { name: true } } } } } },
            },
          },
        },
      }).then(async (entry) => {
        await writeLog(tx, { type: 'CHECKIN', target: `签到：${entry.appointment.patient.name} 号码${queueNumber}`, role: 'FRONTDESK' });
        return entry;
      });
    });
  }

  @Patch(':id/call')
  async call(@Param('id') id: string) {
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.queueEntry.findUniqueOrThrow({
        where: { id },
        include: { appointment: true },
      });
      if (entry.status !== 'WAITING') {
        throw new BadRequestException('只有候诊中状态才能叫号');
      }
      await tx.appointment.update({
        where: { id: entry.appointmentId },
        data: { status: 'CALLED' },
      });
      const called = await tx.queueEntry.update({
        where: { id },
        data: { status: 'CALLED', calledAt: new Date() },
        include: {
          appointment: {
            include: {
              patient: { select: { id: true, name: true, phone: true } },
              schedule: { include: { doctor: { include: { user: { select: { name: true } } } } } },
            },
          },
          skipLogs: { orderBy: { skippedAt: 'asc' } },
        },
      });
      await writeLog(tx, { type: 'CALL_QUEUE', target: `叫号：${called.appointment.patient.name} 号码${entry.queueNumber}`, role: 'FRONTDESK' });
      return called;
    });
  }

  @Patch(':id/skip')
  async skip(@Param('id') id: string) {
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.queueEntry.findUniqueOrThrow({ where: { id } });
      if (entry.status !== 'CALLED') {
        throw new BadRequestException('只有已叫号状态才能过号');
      }
      await tx.queueSkipLog.create({
        data: { queueEntryId: id, originalNumber: entry.queueNumber },
      });
      await tx.appointment.update({
        where: { id: entry.appointmentId },
        data: { status: 'CHECKED_IN' },
      });
      const skipped = await tx.queueEntry.update({
        where: { id },
        data: { status: 'SKIPPED' },
        include: {
          appointment: {
            include: {
              patient: { select: { id: true, name: true, phone: true } },
              schedule: { include: { doctor: { include: { user: { select: { name: true } } } } } },
            },
          },
          skipLogs: { orderBy: { skippedAt: 'asc' } },
        },
      });
      await writeLog(tx, { type: 'SKIP_QUEUE', target: `过号：${skipped.appointment.patient.name} 号码${entry.queueNumber}`, role: 'FRONTDESK' });
      return skipped;
    });
  }

  @Post(':id/requeue')
  async requeue(@Param('id') id: string) {
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.queueEntry.findUniqueOrThrow({ where: { id } });
      if (entry.status !== 'SKIPPED') {
        throw new BadRequestException('只有已过号状态才能重新排队');
      }

      const queueNumber = await this.nextQueueNumber(tx);

      await tx.appointment.update({
        where: { id: entry.appointmentId },
        data: { status: 'CHECKED_IN' },
      });
      const requeued = await tx.queueEntry.update({
        where: { id },
        data: { status: 'WAITING', queueNumber, calledAt: null },
        include: {
          appointment: {
            include: {
              patient: { select: { id: true, name: true, phone: true } },
              schedule: { include: { doctor: { include: { user: { select: { name: true } } } } } },
            },
          },
          skipLogs: { orderBy: { skippedAt: 'asc' } },
        },
      });
      await writeLog(tx, { type: 'REQUEUE', target: `重新排队：${requeued.appointment.patient.name} 新号码${queueNumber}`, role: 'FRONTDESK' });
      return requeued;
    });
  }
}
