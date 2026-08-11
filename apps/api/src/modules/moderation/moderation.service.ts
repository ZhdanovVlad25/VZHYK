import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModerationCase } from './moderation-case.entity';
import { Listing } from '../listings/listing.entity';
import { BANNED_WORDS, ModerationCaseStatus, ModerationDecision } from './moderation.constants';
import { SEARCH_PROVIDER, SearchProvider } from '../../providers/search/search-provider.interface';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RiskService } from '../risk/risk.service';
import { SettingsService } from '../settings/settings.service';

export interface ModerationQueueItem extends Omit<ModerationCase, 'listing'> {
  listing: {
    id: string;
    title: string;
    price: number | null;
    currency: string;
    userId: string;
    /** docs/moderation.md §4 — "Модератор бачить: ... risk score". 0, якщо сигналів ще не було. */
    ownerRiskScore: number;
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
    private readonly auditLog: AuditLogService,
    private readonly risk: RiskService,
    private readonly settings: SettingsService,
  ) {}

  /** Викликається з ListingsService.publish() одразу після переведення listing у PENDING_MODERATION. */
  async createCaseForListing(listing: Listing): Promise<ModerationCase> {
    const bannedWordReason = this.findBannedWord(listing.title, listing.description);
    const isDuplicate = await this.risk.checkDuplicateListing(listing.userId, listing.title, listing.price, listing.id);
    const ownerRiskScore = await this.risk.getScore(listing.userId);
    const needsReviewThreshold = await this.settings.getRiskNeedsReviewThreshold();

    let flagReason = bannedWordReason;
    if (!flagReason && isDuplicate) {
      flagReason = 'DUPLICATE_LISTING';
    }
    if (!flagReason && ownerRiskScore > needsReviewThreshold) {
      flagReason = `RISK_SCORE:${ownerRiskScore}`;
    }

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
    const riskScores = await this.risk.getScores([...new Set(listings.map((l) => l.userId))]);

    return cases.map((c) => {
      const listing = byId.get(c.listingId);
      return {
        ...c,
        listing: listing
          ? {
              id: listing.id,
              title: listing.title,
              price: listing.price,
              currency: listing.currency,
              userId: listing.userId,
              ownerRiskScore: riskScores.get(listing.userId) ?? 0,
            }
          : null,
      };
    });
  }

  async decide(moderatorId: string, caseId: string, decision: ModerationDecision, ip: string | null): Promise<ModerationCase> {
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

    const before = { caseStatus: moderationCase.status };

    if (decision === 'APPROVED' || decision === 'REJECTED') {
      await this.applyDecisionToListing(moderationCase.listingId, decision);
    }

    Object.assign(moderationCase, {
      status: decision,
      moderatorId,
      decidedAt: new Date(),
    });
    const saved = await this.cases.save(moderationCase);

    await this.auditLog.record({
      actorUserId: moderatorId,
      action: 'moderation.decide',
      targetType: 'moderation_case',
      targetId: saved.id,
      before,
      after: { caseStatus: saved.status, listingId: saved.listingId },
      ip,
    });

    return saved;
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
