import { Module } from '@nestjs/common';
import { DoctorController } from './doctor.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [DoctorController],
  providers: [PrismaService],
})
export class DoctorModule {}
