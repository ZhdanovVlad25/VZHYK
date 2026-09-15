import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { LISTING_CURRENCIES, ListingCurrency } from '../listing.constants';
import { IsUuidLike } from '../../../shared/validators/is-uuid-like.decorator';

const ADMIN_LISTING_STATUSES = ['ACTIVE', 'BLOCKED'] as const;
type AdminListingStatus = (typeof ADMIN_LISTING_STATUSES)[number];

/** docs/api.md §12 PATCH /admin/listings/:id — "Редагування/блокування". */
export class AdminUpdateListingDto {
  @IsOptional()
  @IsIn(ADMIN_LISTING_STATUSES)
  status?: AdminListingStatus;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(140)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsIn(LISTING_CURRENCIES)
  currency?: ListingCurrency;

  /** Переміщення в іншу (кінцеву) категорію — напр. виправити помилково обрану власником. */
  @IsOptional()
  @IsUuidLike()
  categoryId?: string;
}
