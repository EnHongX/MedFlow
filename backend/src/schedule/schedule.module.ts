import { Module } from '@nestjs/common';
import { ScheduleController } from './schedule.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ScheduleController],
  providers: [PrismaService],
})
export class ScheduleModule {}
