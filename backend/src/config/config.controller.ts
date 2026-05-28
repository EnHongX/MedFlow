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
      create: {
        id: 'singleton',
        cancelDeadlineHours: 2,
        advanceBookingDays: 7,
        lateThresholdMinutes: 15,
        noShowThresholdMinutes: 30,
      },
    });
  }

  @Patch()
  async update(@Body() body: {
    cancelDeadlineHours?: number;
    advanceBookingDays?: number;
    lateThresholdMinutes?: number;
    noShowThresholdMinutes?: number;
  }) {
    if (body.lateThresholdMinutes !== undefined || body.noShowThresholdMinutes !== undefined) {
      const current = await this.prisma.clinicConfig.findUnique({ where: { id: 'singleton' } });
      const late = body.lateThresholdMinutes ?? current?.lateThresholdMinutes ?? 15;
      const noShow = body.noShowThresholdMinutes ?? current?.noShowThresholdMinutes ?? 30;
      if (late <= 0 || noShow <= 0) {
        throw new BadRequestException('阈值必须为正整数');
      }
      if (late >= noShow) {
        throw new BadRequestException('迟到阈值必须小于爽约阈值');
      }
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
