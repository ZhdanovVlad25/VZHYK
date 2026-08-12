import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from './report.entity';
import { Listing } from '../listings/listing.entity';
import { User } from '../users/user.entity';
import { ChatParticipant } from '../chat/chat-participant.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { AdminReportsController } from './admin-reports.controller';
import { RiskModule } from '../risk/risk.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [TypeOrmModule.forFeature([Report, Listing, User, ChatParticipant]), RiskModule, AuditLogModule],
  controllers: [ReportsController, AdminReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
