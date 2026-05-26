import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('visit-records')
export class VisitRecordController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async findAll(
    @Query('patientPhone') patientPhone?: string,
    @Query('doctorId') doctorId?: string,
    @Query('dateStart') dateStart?: string,
    @Query('dateEnd') dateEnd?: string,
  ) {
    const where: Record<string, unknown> = {};

    if (patientPhone || doctorId) {
      const appointmentWhere: Record<string, unknown> = {};
      if (patientPhone) {
        appointmentWhere.patient = { phone: patientPhone };
      }
      if (doctorId) {
        appointmentWhere.schedule = { doctorId };
      }
      where.appointment = appointmentWhere;
    }

    if (dateStart || dateEnd) {
      const dateFilter: Record<string, Date> = {};
      if (dateStart) dateFilter.gte = new Date(dateStart);
      if (dateEnd) {
        const end = new Date(dateEnd);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      where.createdAt = dateFilter;
    }

    return this.prisma.visitRecord.findMany({
      where,
      include: {
        appointment: {
          include: {
            patient: { select: { id: true, name: true, phone: true } },
            schedule: {
              include: {
                doctor: { include: { user: { select: { name: true } }, department: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
