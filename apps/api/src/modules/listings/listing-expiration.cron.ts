import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { Listing } from './listing.entity';
import { LISTING_EXPIRY_DAYS } from './listing.constants';
import { SEARCH_PROVIDER, SearchProvider } from '../../providers/search/search-provider.interface';

/**
 * "Оголошення має бути опубліковане 30 днів" — годинна перевірка ACTIVE оголошень з
 * expiresAt у минулому. autoRenew=true продовжує термін ще на LISTING_EXPIRY_DAYS
 * (той самий результат, що й ручне ListingsService.renew()); інакше — EXPIRED і геть
 * з пошукового індексу (той самий патерн, що archive()/markSold()).
 */
@Injectable()
export class ListingExpirationCron {
  private readonly logger = new Logger(ListingExpirationCron.name);

  constructor(
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    @Inject(SEARCH_PROVIDER) private readonly search: SearchProvider,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handle(): Promise<void> {
    const now = new Date();

    const dueForAutoRenew = await this.listings.find({
      where: { status: 'ACTIVE', autoRenew: true, expiresAt: LessThanOrEqual(now) },
    });
    if (dueForAutoRenew.length > 0) {
      const nextExpiry = new Date(Date.now() + LISTING_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      await this.listings.update(
        dueForAutoRenew.map((l) => l.id),
        { expiresAt: nextExpiry },
      );
      this.logger.log(`Auto-продовжено ${dueForAutoRenew.length} оголошень`);
    }

    const dueForExpiry = await this.listings.find({
      where: { status: 'ACTIVE', autoRenew: false, expiresAt: LessThanOrEqual(now) },
    });
    for (const listing of dueForExpiry) {
      listing.status = 'EXPIRED';
      await this.listings.save(listing);
      await this.search.remove(listing.id);
    }
    if (dueForExpiry.length > 0) {
      this.logger.log(`Переведено в EXPIRED: ${dueForExpiry.length} оголошень`);
    }
  }
}
