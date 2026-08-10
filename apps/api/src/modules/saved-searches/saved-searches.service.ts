import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedSearch } from './saved-search.entity';
import { Category } from '../categories/category.entity';
import { Location } from '../location/location.entity';
import { CreateSavedSearchDto } from './dto/create-saved-search.dto';

/** docs/api.md §8 Saved Searches — без активних сповіщень про збіг (roadmap "Після MVP"). */
@Injectable()
export class SavedSearchesService {
  constructor(
    @InjectRepository(SavedSearch) private readonly savedSearches: Repository<SavedSearch>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(Location) private readonly locations: Repository<Location>,
  ) {}

  async create(userId: string, dto: CreateSavedSearchDto): Promise<SavedSearch> {
    if (dto.categoryId) {
      await this.assertCategoryExists(dto.categoryId);
    }
    if (dto.regionLocationId) {
      await this.assertLocationExists(dto.regionLocationId);
    }

    return this.savedSearches.save(
      this.savedSearches.create({
        userId,
        queryText: dto.queryText ?? null,
        categoryId: dto.categoryId ?? null,
        filters: dto.filters ?? null,
        regionLocationId: dto.regionLocationId ?? null,
      }),
    );
  }

  list(userId: string): Promise<SavedSearch[]> {
    return this.savedSearches.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async remove(userId: string, id: string): Promise<void> {
    const item = await this.savedSearches.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException({ code: 'SAVED_SEARCH_NOT_FOUND', message: 'Збережений пошук не знайдено' });
    }
    if (item.userId !== userId) {
      throw new ForbiddenException({ code: 'SAVED_SEARCH_NOT_OWNER', message: 'Цей пошук належить іншому користувачу' });
    }
    await this.savedSearches.remove(item);
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const category = await this.categories.findOne({ where: { id: categoryId } });
    if (!category) {
      throw new NotFoundException({ code: 'CATEGORY_NOT_FOUND', message: 'Категорію не знайдено' });
    }
  }

  private async assertLocationExists(locationId: string): Promise<void> {
    const location = await this.locations.findOne({ where: { id: locationId } });
    if (!location) {
      throw new NotFoundException({ code: 'LOCATION_NOT_FOUND', message: 'Локацію не знайдено' });
    }
  }
}
