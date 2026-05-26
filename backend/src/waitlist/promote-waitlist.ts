import { writeLog } from '../operation-log/log-helper';

type TxClient = {
  $executeRaw: any;
  $queryRaw: any;
  schedule: any;
  waitlistEntry: any;
  appointment: any;
  operationLog: any;
};

export async function promoteWaitlist(tx: TxClient, scheduleId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(2027)`;

  await tx.$queryRaw`SELECT id FROM schedules WHERE id = ${scheduleId} FOR UPDATE`;
  const schedule = await tx.schedule.findUniqueOrThrow({ where: { id: scheduleId } });
  if (schedule.suspended || schedule.remaining <= 0) return;

  let slotsAvailable = schedule.remaining;

  const pendingEntries = await tx.waitlistEntry.findMany({
    where: { scheduleId, status: 'PENDING' },
    orderBy: { position: 'asc' },
  });

  if (pendingEntries.length === 0) return;

  for (const entry of pendingEntries) {
    if (slotsAvailable <= 0) break;

    const existingAppt = await tx.appointment.findFirst({
      where: {
        patientId: entry.patientId,
        scheduleId,
        status: { in: ['BOOKED', 'CHECKED_IN', 'CALLED', 'IN_PROGRESS'] },
      },
    });

    if (existingAppt) {
      await tx.waitlistEntry.update({
        where: { id: entry.id },
        data: { status: 'CLOSED', closeReason: '跳过：患者已有该时段有效预约' },
      });
      await writeLog(tx as any, {
        type: 'WAITLIST_CLOSE',
        target: `候补跳过：患者${entry.patientId}（已有有效预约）`,
        role: 'ADMIN',
      });
      continue;
    }

    const appointment = await tx.appointment.create({
      data: { patientId: entry.patientId, scheduleId, status: 'BOOKED' },
    });

    await tx.schedule.update({
      where: { id: scheduleId },
      data: { remaining: { decrement: 1 } },
    });
    slotsAvailable--;

    await tx.waitlistEntry.update({
      where: { id: entry.id },
      data: { status: 'PROMOTED', appointmentId: appointment.id },
    });

    await writeLog(tx as any, {
      type: 'WAITLIST_PROMOTE',
      target: `候补转正：患者${entry.patientId} -> 预约${appointment.id}`,
      role: 'ADMIN',
    });
  }
}
