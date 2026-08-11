import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModerationCase } from './moderation-case.entity';
import { Listing } from '../listings/listing.entity';
import { ModerationService } from './moderation.service';
import { ModerationController } from './moderation.controller';
import { SearchProviderModule } from '../../providers/search/search.module';

@Module({
  imports: [TypeOrmModule.forFeature([ModerationCase, Listing]), SearchProviderModule],
  controllers: [ModerationController],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
