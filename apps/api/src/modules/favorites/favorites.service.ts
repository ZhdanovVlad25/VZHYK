import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Favorite } from './favorite.entity';
import { Listing } from '../listings/listing.entity';
import { PUBLICLY_VISIBLE_LISTING_STATUSES } from '../listings/listing.constants';

export interface FavoriteView {
  id: string;
  listingId: string;
  createdAt: Date;
  listing: {
    id: string;
    title: string;
    price: number | null;
    currency: string;
    status: string;
  };
  isUnavailable: boolean;
  priceChanged: boolean;
}

/** docs/api.md §8 Favorites. */
@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite) private readonly favorites: Repository<Favorite>,
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
  ) {}

  /** Ідемпотентний: повторний POST на вже обране оголошення повертає існуючий запис, не 409. */
  async add(userId: string, listingId: string): Promise<Favorite> {
    const existing = await this.favorites.findOne({ where: { userId, listingId } });
    if (existing) {
      return existing;
    }

    const listing = await this.listings.findOne({ where: { id: listingId, deletedAt: IsNull() } });
    if (!listing) {
      throw new NotFoundException({ code: 'LISTING_NOT_FOUND', message: 'Оголошення не знайдено' });
    }

    return this.favorites.save(this.favorites.create({ userId, listingId, priceSnapshot: listing.price }));
  }

  /** Ідемпотентний: DELETE на те, чого немає в обраному, теж успішний. */
  async remove(userId: string, listingId: string): Promise<void> {
    await this.favorites.delete({ userId, listingId });
  }

  async count(userId: string): Promise<number> {
    return this.favorites.count({ where: { userId } });
  }

  async list(userId: string): Promise<FavoriteView[]> {
    const rows = await this.favorites.find({ where: { userId }, order: { createdAt: 'DESC' } });
    if (rows.length === 0) {
      return [];
    }

    const listingIds = rows.map((r) => r.listingId);
    const listings = await this.listings.find({ where: listingIds.map((id) => ({ id })) });
    const byId = new Map(listings.map((l) => [l.id, l]));

    return rows.map((row) => {
      const listing = byId.get(row.listingId);
      const isUnavailable = !listing || listing.deletedAt !== null || !PUBLICLY_VISIBLE_LISTING_STATUSES.includes(listing.status);
      const priceChanged = Boolean(
        listing && listing.price !== null && row.priceSnapshot !== null && listing.price !== row.priceSnapshot,
      );

      return {
        id: row.id,
        listingId: row.listingId,
        createdAt: row.createdAt,
        listing: {
          id: listing?.id ?? row.listingId,
          title: listing?.title ?? '',
          price: listing?.price ?? null,
          currency: listing?.currency ?? 'UAH',
          status: listing?.status ?? 'DELETED',
        },
        isUnavailable,
        priceChanged,
      };
    });
  }
}
