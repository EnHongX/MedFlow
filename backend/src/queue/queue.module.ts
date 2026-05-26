import { Module } from '@nestjs/common';
import { QueueController } from './queue.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [QueueController],
  providers: [PrismaService],
})
export class QueueModule {}
