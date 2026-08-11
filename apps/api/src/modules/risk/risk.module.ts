import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RiskSignal } from './risk-signal.entity';
import { RiskScore } from './risk-score.entity';
import { Listing } from '../listings/listing.entity';
import { Report } from '../reports/report.entity';
import { RiskService } from './risk.service';

@Module({
  imports: [TypeOrmModule.forFeature([RiskSignal, RiskScore, Listing, Report])],
  providers: [RiskService],
  exports: [RiskService],
})
export class RiskModule {}
