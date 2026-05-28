import { Controller, Get, Patch, Body, BadRequestException } from '@nestjs/common';
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
  async update(
    @Body()
    body: {
      cancelDeadlineHours?: number;
      advanceBookingDays?: number;
      lateThresholdMinutes?: number;
      noShowThresholdMinutes?: number;
    },
  ) {
    const current = await this.prisma.clinicConfig.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton', cancelDeadlineHours: 2, advanceBookingDays: 7 },
    });

    const late = body.lateThresholdMinutes ?? current.lateThresholdMinutes;
    const noShow = body.noShowThresholdMinutes ?? current.noShowThresholdMinutes;
    if (late >= noShow) {
      throw new BadRequestException('迟到阈值必须小于爽约阈值');
    }

    return this.prisma.clinicConfig.upsert({
      where: { id: 'singleton' },
      update: body,
      create: {
        id: 'singleton',
        cancelDeadlineHours: body.cancelDeadlineHours ?? 2,
        advanceBookingDays: body.advanceBookingDays ?? 7,
        lateThresholdMinutes: body.lateThresholdMinutes ?? 15,
        noShowThresholdMinutes: body.noShowThresholdMinutes ?? 30,
      },
    });
  }
}
