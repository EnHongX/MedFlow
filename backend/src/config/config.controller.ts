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
    // 正整数验证
    if (body.lateThresholdMinutes !== undefined) {
      if (!Number.isInteger(body.lateThresholdMinutes) || body.lateThresholdMinutes <= 0) {
        throw new BadRequestException('迟到阈值必须为正整数');
      }
    }

    if (body.noShowThresholdMinutes !== undefined) {
      if (!Number.isInteger(body.noShowThresholdMinutes) || body.noShowThresholdMinutes <= 0) {
        throw new BadRequestException('爽约阈值必须为正整数');
      }
    }

    //阈值顺序验证：使用当前配置作为未提供字段的比对基准
    // 场景：管理员只修改一个阈值时，应与当前已有值比较，而非与默认值比较
    // 避免：DB 中 noShow=25, 用户只改 late=20, 却与默认值 30 比较通过（正确）
    // 但如：DB 中 late=10, noShow=20, 用户只改 late=25, 需与当前 noShow=20 比较拒绝
    const current = await this.prisma.clinicConfig.findUnique({ where: { id: 'singleton' } });
    const late = body.lateThresholdMinutes ?? (current?.lateThresholdMinutes ?? 15);
    const noShow = body.noShowThresholdMinutes ?? (current?.noShowThresholdMinutes ?? 30);

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
