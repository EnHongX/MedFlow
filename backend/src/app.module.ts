import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';
import { DepartmentModule } from './department/department.module';
import { DoctorModule } from './doctor/doctor.module';
import { ScheduleModule } from './schedule/schedule.module';
import { AppointmentModule } from './appointment/appointment.module';
import { QueueModule } from './queue/queue.module';
import { PatientModule } from './patient/patient.module';
import { ConfigModule } from './config/config.module';
import { ChangeRequestModule } from './change-request/change-request.module';
import { OperationLogModule } from './operation-log/operation-log.module';
import { WaitlistModule } from './waitlist/waitlist.module';
import { VisitRecordModule } from './visit-record/visit-record.module';

@Module({
  imports: [
    DepartmentModule,
    DoctorModule,
    ScheduleModule,
    AppointmentModule,
    QueueModule,
    PatientModule,
    ConfigModule,
    ChangeRequestModule,
    OperationLogModule,
    WaitlistModule,
    VisitRecordModule,
  ],
  controllers: [HealthController],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
