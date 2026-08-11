import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from './report.entity';
import { Listing } from '../listings/listing.entity';
import { User } from '../users/user.entity';
import { ChatParticipant } from '../chat/chat-participant.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Report, Listing, User, ChatParticipant])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
