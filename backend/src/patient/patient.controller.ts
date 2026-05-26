import { Controller, Get, Post, Body, Query, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('patients')
export class PatientController {
  constructor(private prisma: PrismaService) {}

  @Get()
  findAll(@Query('phone') phone?: string) {
    const where: Record<string, unknown> = { role: 'PATIENT' };
    if (phone) where.phone = phone;
    return this.prisma.user.findMany({ where, select: { id: true, name: true, phone: true } });
  }

  @Post()
  async create(@Body() body: { name: string; phone: string; password: string }) {
    if (!body.phone?.trim()) throw new BadRequestException('手机号不能为空');

    const existing = await this.prisma.user.findUnique({ where: { phone: body.phone.trim() } });
    if (existing) {
      throw new BadRequestException(`手机号 ${body.phone.trim()} 已被注册`);
    }

    return this.prisma.user.create({
      data: { name: body.name?.trim() || `患者_${body.phone.trim().slice(-4)}`, phone: body.phone.trim(), password: body.password || '123456', role: 'PATIENT' },
      select: { id: true, name: true, phone: true },
    });
  }
}
