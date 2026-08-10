import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from './listing.entity';
import { ListingAttributeValue } from './listing-attribute-value.entity';
import { Category } from '../categories/category.entity';
import { CategoryAttribute } from '../attributes/category-attribute.entity';
import { ListingsService } from './listings.service';
import { ListingsController } from './listings.controller';
import { SettingsModule } from '../settings/settings.module';
import { SearchProviderModule } from '../../providers/search/search.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Listing, ListingAttributeValue, Category, CategoryAttribute]),
    SettingsModule,
    SearchProviderModule,
  ],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
