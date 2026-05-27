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
      create: { id: 'singleton', cancelDeadlineHours: 2, advanceBookingDays: 7, lateThresholdMinutes: 15, noShowThresholdMinutes: 30 },
    });
  }

  @Patch()
  async update(@Body() body: { cancelDeadlineHours?: number; advanceBookingDays?: number; lateThresholdMinutes?: number; noShowThresholdMinutes?: number }) {
    // Reject negative or zero values for time thresholds
    if (body.lateThresholdMinutes !== undefined && body.lateThresholdMinutes <= 0) {
      throw new BadRequestException('迟到阈值必须为正整数');
    }
    if (body.noShowThresholdMinutes !== undefined && body.noShowThresholdMinutes <= 0) {
      throw new BadRequestException('爽约阈值必须为正整数');
    }

    // Validate that lateThresholdMinutes < noShowThresholdMinutes
    const current = await this.prisma.clinicConfig.findFirst();
    const lateThreshold = body.lateThresholdMinutes ?? current?.lateThresholdMinutes ?? 15;
    const noShowThreshold = body.noShowThresholdMinutes ?? current?.noShowThresholdMinutes ?? 30;

    if (lateThreshold >= noShowThreshold) {
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
