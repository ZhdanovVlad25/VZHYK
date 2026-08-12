import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Listing } from '../listings/listing.entity';
import { ModerationCase } from '../moderation/moderation-case.entity';
import { Report } from '../reports/report.entity';
import { RiskScore } from '../risk/risk-score.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Listing, ModerationCase, Report, RiskScore]), SettingsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
