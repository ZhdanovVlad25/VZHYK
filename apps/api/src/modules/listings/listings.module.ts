import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from './listing.entity';
import { ListingAttributeValue } from './listing-attribute-value.entity';
import { PriceHistory } from './price-history.entity';
import { Category } from '../categories/category.entity';
import { CategoryAttribute } from '../attributes/category-attribute.entity';
import { ListingsService } from './listings.service';
import { ListingsController } from './listings.controller';
import { SettingsModule } from '../settings/settings.module';
import { SearchProviderModule } from '../../providers/search/search.module';
import { ModerationModule } from '../moderation/moderation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Listing, ListingAttributeValue, PriceHistory, Category, CategoryAttribute]),
    SettingsModule,
    SearchProviderModule,
    ModerationModule,
  ],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
