import { Controller, Get, Patch, Body } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('config')
export class ConfigController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async findOne() {
    return this.prisma.clinicConfig.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton', cancelDeadlineHours: 2, advanceBookingDays: 7 },
    });
  }

  @Patch()
  async update(@Body() body: { cancelDeadlineHours?: number; advanceBookingDays?: number }) {
    return this.prisma.clinicConfig.upsert({
      where: { id: 'singleton' },
      update: body,
      create: {
        id: 'singleton',
        cancelDeadlineHours: body.cancelDeadlineHours ?? 2,
        advanceBookingDays: body.advanceBookingDays ?? 7,
      },
    });
  }
}
