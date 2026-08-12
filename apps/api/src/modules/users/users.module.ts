import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { User } from './user.entity';
import { Listing } from '../listings/listing.entity';
import { Report } from '../reports/report.entity';
import { RiskSignal } from '../risk/risk-signal.entity';
import { RiskScore } from '../risk/risk-score.entity';
import { ProfilesModule } from '../profiles/profiles.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Listing, Report, RiskSignal, RiskScore]),
    ProfilesModule,
    AuditLogModule,
  ],
  controllers: [UsersController, AdminUsersController],
  providers: [AdminUsersService],
})
export class UsersModule {}
