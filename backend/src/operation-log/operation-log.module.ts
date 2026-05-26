import { Module } from '@nestjs/common';
import { OperationLogController } from './operation-log.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [OperationLogController],
  providers: [PrismaService],
})
export class OperationLogModule {}
