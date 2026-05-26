import { Module } from '@nestjs/common';
import { DepartmentController } from './department.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [DepartmentController],
  providers: [PrismaService],
})
export class DepartmentModule {}
