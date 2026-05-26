import { Module } from '@nestjs/common';
import { PatientController } from './patient.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [PatientController],
  providers: [PrismaService],
})
export class PatientModule {}
