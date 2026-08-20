import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { LISTING_CONDITIONS, ListingCondition } from '../../listings/listing.constants';
import { SearchSort } from '../../../providers/search/search-provider.interface';
import { IsUuidLike } from '../../../shared/validators/is-uuid-like.decorator';

const SORTS: SearchSort[] = ['relevance', 'newest', 'price_asc', 'price_desc'];

/** docs/api.md §7 Search. region/city/district та attrs[] — див. PostgresFtsSearchProvider, поза цим зрізом. */
export class SearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsUuidLike()
  category?: string;

  @IsOptional()
  @IsUuidLike()
  location?: string;

  @IsOptional()
  @IsUuidLike()
  seller?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceMax?: number;

  @IsOptional()
  @IsIn(LISTING_CONDITIONS)
  condition?: ListingCondition;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  hasPhoto?: boolean;

  @IsOptional()
  @IsIn(SORTS)
  sort?: SearchSort;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
