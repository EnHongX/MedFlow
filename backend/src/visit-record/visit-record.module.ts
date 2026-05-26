import { Module } from '@nestjs/common';
import { VisitRecordController } from './visit-record.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [VisitRecordController],
  providers: [PrismaService],
})
export class VisitRecordModule {}
