import { Module } from '@nestjs/common';
import { ChangeRequestController } from './change-request.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ChangeRequestController],
  providers: [PrismaService],
})
export class ChangeRequestModule {}
