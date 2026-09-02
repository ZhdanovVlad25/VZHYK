import { Inject, Injectable } from '@nestjs/common';
import { SEARCH_PROVIDER, SearchProvider, SearchResult } from '../../providers/search/search-provider.interface';
import { SearchQueryDto } from './dto/search-query.dto';

@Injectable()
export class SearchService {
  constructor(@Inject(SEARCH_PROVIDER) private readonly provider: SearchProvider) {}

  search(dto: SearchQueryDto): Promise<SearchResult> {
    return this.provider.search({
      q: dto.q,
      categoryId: dto.category,
      locationId: dto.location,
      userId: dto.seller,
      priceMin: dto.priceMin,
      priceMax: dto.priceMax,
      condition: dto.condition,
      listingType: dto.listingType,
      hasPhoto: dto.hasPhoto,
      sort: dto.sort,
      cursor: dto.cursor,
      limit: dto.limit,
    });
  }

  suggest(q: string): Promise<string[]> {
    return this.provider.suggest(q);
  }
}
