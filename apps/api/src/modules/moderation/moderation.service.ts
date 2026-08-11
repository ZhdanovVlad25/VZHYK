import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModerationCase } from './moderation-case.entity';
import { Listing } from '../listings/listing.entity';
import { BANNED_WORDS, ModerationCaseStatus, ModerationDecision } from './moderation.constants';
import { SEARCH_PROVIDER, SearchProvider } from '../../providers/search/search-provider.interface';

export interface ModerationQueueItem extends Omit<ModerationCase, 'listing'> {
  listing: {
    id: string;
    title: string;
    price: number | null;
    currency: string;
    userId: string;
  } | null;
}

/**
 * docs/api.md §12 — черга модерації. Викликається з ListingsService.publish() (пряма
 * DI-залежність, не подія: рішення модератора має синхронно й детерміновано міняти
 * статус оголошення в межах того самого HTTP-запиту, на відміну від WS push у чаті).
 */
@Injectable()
export class ModerationService {
  constructor(
    @InjectRepository(ModerationCase) private readonly cases: Repository<ModerationCase>,
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    @Inject(SEARCH_PROVIDER) private readonly search: SearchProvider,
  ) {}

  /** Викликається з ListingsService.publish() одразу після переведення listing у PENDING_MODERATION. */
  async createCaseForListing(listing: Listing): Promise<ModerationCase> {
    const flagReason = this.findBannedWord(listing.title, listing.description);

    return this.cases.save(
      this.cases.create({
        listingId: listing.id,
        status: flagReason ? 'NEEDS_REVIEW' : 'PENDING',
        autoFlagReason: flagReason,
      }),
    );
  }

  async findQueue(status?: ModerationCaseStatus): Promise<ModerationQueueItem[]> {
    const where = status ? { status } : {};
    const cases = await this.cases.find({ where, order: { createdAt: 'ASC' } });
    if (cases.length === 0) {
      return [];
    }

    const listingIds = [...new Set(cases.map((c) => c.listingId))];
    const listings = await this.listings.find({ where: listingIds.map((id) => ({ id })) });
    const byId = new Map(listings.map((l) => [l.id, l]));

    return cases.map((c) => {
      const listing = byId.get(c.listingId);
      return {
        ...c,
        listing: listing
          ? { id: listing.id, title: listing.title, price: listing.price, currency: listing.currency, userId: listing.userId }
          : null,
      };
    });
  }

  async decide(moderatorId: string, caseId: string, decision: ModerationDecision): Promise<ModerationCase> {
    const moderationCase = await this.cases.findOne({ where: { id: caseId } });
    if (!moderationCase) {
      throw new NotFoundException({ code: 'MODERATION_CASE_NOT_FOUND', message: 'Справу не знайдено' });
    }
    if (!['PENDING', 'NEEDS_REVIEW'].includes(moderationCase.status)) {
      throw new BadRequestException({
        code: 'MODERATION_CASE_ALREADY_DECIDED',
        message: `Справа вже має рішення: ${moderationCase.status}`,
      });
    }

    if (decision === 'APPROVED' || decision === 'REJECTED') {
      await this.applyDecisionToListing(moderationCase.listingId, decision);
    }

    Object.assign(moderationCase, {
      status: decision,
      moderatorId,
      decidedAt: new Date(),
    });
    return this.cases.save(moderationCase);
  }

  private async applyDecisionToListing(listingId: string, decision: 'APPROVED' | 'REJECTED'): Promise<void> {
    const listing = await this.listings.findOne({ where: { id: listingId } });
    if (!listing || listing.status !== 'PENDING_MODERATION') {
      // Оголошення вже змінилось/видалилось між чергою і рішенням — рішення по справі
      // все одно фіксується вище, але статус listing не займаємо, щоб не перезаписати.
      return;
    }

    if (decision === 'APPROVED') {
      listing.status = 'ACTIVE';
      listing.publishedAt = new Date();
      await this.listings.save(listing);
      await this.search.index(listing.id);
    } else {
      listing.status = 'REJECTED';
      await this.listings.save(listing);
    }
  }

  private findBannedWord(title: string, description: string | null): string | null {
    const haystack = `${title} ${description ?? ''}`.toLowerCase();
    const hit = BANNED_WORDS.find((word) => haystack.includes(word));
    return hit ? `BANNED_WORD:${hit}` : null;
  }
}
