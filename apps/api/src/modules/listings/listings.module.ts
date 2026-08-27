import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Listing } from './listing.entity';
import { ListingAttributeValue } from './listing-attribute-value.entity';
import { PriceHistory } from './price-history.entity';
import { Category } from '../categories/category.entity';
import { CategoryAttribute } from '../attributes/category-attribute.entity';
import { User } from '../users/user.entity';
import { ListingsService } from './listings.service';
import { ListingsController } from './listings.controller';
import { ListingExpirationCron } from './listing-expiration.cron';
import { AdminListingsService } from './admin-listings.service';
import { AdminListingsController } from './admin-listings.controller';
import { SettingsModule } from '../settings/settings.module';
import { SearchProviderModule } from '../../providers/search/search.module';
import { ModerationModule } from '../moderation/moderation.module';
import { RiskModule } from '../risk/risk.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Listing, ListingAttributeValue, PriceHistory, Category, CategoryAttribute, User]),
    ScheduleModule.forRoot(),
    SettingsModule,
    SearchProviderModule,
    ModerationModule,
    RiskModule,
    AuditLogModule,
  ],
  controllers: [ListingsController, AdminListingsController],
  providers: [ListingsService, AdminListingsService, ListingExpirationCron],
  exports: [ListingsService],
})
export class ListingsModule {}
