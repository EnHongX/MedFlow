import { Controller, Get, Post, Body, Query, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { writeLog } from '../operation-log/log-helper';

@Controller('doctors')
export class DoctorController {
  constructor(private prisma: PrismaService) {}

  @Get()
  findAll(@Query('departmentId') departmentId?: string) {
    return this.prisma.doctor.findMany({
      where: departmentId ? { departmentId } : undefined,
      include: { user: { select: { id: true, name: true, phone: true } }, department: true },
      orderBy: { user: { name: 'asc' } },
    });
  }

  @Post()
  async create(@Body() body: { name: string; phone: string; password: string; departmentId: string; title: string }) {
    try {
      if (!body.name?.trim()) throw new BadRequestException('姓名不能为空');
      if (!body.phone?.trim()) throw new BadRequestException('手机号不能为空');
      if (!body.departmentId) throw new BadRequestException('请选择科室');

      const existingUser = await this.prisma.user.findUnique({ where: { phone: body.phone.trim() } });
      if (existingUser) {
        throw new BadRequestException(`手机号 ${body.phone.trim()} 已被注册`);
      }

      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { name: body.name.trim(), phone: body.phone.trim(), password: body.password || '123456', role: 'DOCTOR' },
        });
        const doctor = await tx.doctor.create({
          data: { userId: user.id, departmentId: body.departmentId, title: body.title || '' },
          include: { user: { select: { id: true, name: true, phone: true } }, department: true },
        });
        await writeLog(tx, { type: 'CREATE_DOCTOR', target: `医生：${body.name.trim()}（${body.phone.trim()}）`, role: 'ADMIN' });
        return doctor;
      });
    } catch (e: any) {
      if (e instanceof BadRequestException) {
        await writeLog(this.prisma, { type: 'CREATE_DOCTOR', target: `医生：${body.name?.trim() || '(空)'}（${body.phone?.trim() || ''}）`, role: 'ADMIN', result: 'fail', remark: e.message });
      }
      throw e;
    }
  }
}
