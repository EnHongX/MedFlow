import { Controller, Get, Post, Body, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { writeLog } from '../operation-log/log-helper';

@Controller('departments')
export class DepartmentController {
  constructor(private prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.department.findMany({ orderBy: { name: 'asc' } });
  }

  @Post()
  async create(@Body() body: { name: string }) {
    try {
      if (!body.name?.trim()) {
        throw new BadRequestException('科室名称不能为空');
      }
      const existing = await this.prisma.department.findUnique({ where: { name: body.name.trim() } });
      if (existing) {
        throw new BadRequestException(`科室「${body.name.trim()}」已存在`);
      }
      return await this.prisma.$transaction(async (tx) => {
        const dept = await tx.department.create({ data: { name: body.name.trim() } });
        await writeLog(tx, { type: 'CREATE_DEPARTMENT', target: `科室：${dept.name}`, role: 'ADMIN' });
        return dept;
      });
    } catch (e: any) {
      if (e instanceof BadRequestException) {
        await writeLog(this.prisma, { type: 'CREATE_DEPARTMENT', target: `科室：${body.name?.trim() || '(空)'}`, role: 'ADMIN', result: 'fail', remark: e.message });
      }
      throw e;
    }
  }
}
