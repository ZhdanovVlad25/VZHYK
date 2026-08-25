import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { Listing } from '../listings/listing.entity';
import { Media } from '../media/media.entity';
import { User } from '../users/user.entity';
import { ModerationCase } from './moderation-case.entity';
import { ModerationDecision } from './moderation.constants';
import { STORAGE_PROVIDER, StorageProvider } from '../../providers/storage/storage-provider.interface';
import { EMAIL_PROVIDER_TOKEN, EmailProvider } from '../../providers/email/email-provider.interface';

export interface ModerationEmailAction {
  caseId: string;
  decision: ModerationDecision;
  moderatorId: string;
}

const MAX_PHOTOS_IN_EMAIL = 5;

/**
 * "Модерація поштою" — на прохання власника: нове оголошення на модерації надсилає лист
 * із фото/описом і кнопками "Схвалити"/"Відхилити", які ведуть на публічний (без логіну)
 * endpoint. Захист — HMAC-підпис токена (verifyToken), а не автентифікація: клік з
 * поштового клієнта не може нести Authorization header, тож JwtAuthGuard тут недоречний.
 *
 * Навмисно НЕ через MediaModule/StorageModule ланцюжок MediaService (він тягне
 * ListingsModule, а ListingsModule вже імпортує ModerationModule — цикл). Media repo +
 * StorageProvider підключені сюди напряму, той самий набір, що й MediaService.listForListing().
 */
@Injectable()
export class ModerationEmailService {
  private readonly logger = new Logger(ModerationEmailService.name);

  constructor(
    @InjectRepository(Media) private readonly media: Repository<Media>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    @Inject(EMAIL_PROVIDER_TOKEN) private readonly email: EmailProvider,
    private readonly config: ConfigService,
  ) {}

  /** Викликається з ModerationService.createCaseForListing() — best-effort, не блокує публікацію оголошення. */
  async notifyNewCase(listing: Listing, moderationCase: ModerationCase): Promise<void> {
    const to = this.config.get<string>('MODERATION_NOTIFY_EMAIL');
    const secret = this.config.get<string>('MODERATION_EMAIL_SECRET');
    if (!to || !secret) {
      this.logger.warn('MODERATION_NOTIFY_EMAIL/MODERATION_EMAIL_SECRET не задано — email-сповіщення пропущено');
      return;
    }

    try {
      const moderator = await this.resolveModerator();
      if (!moderator) {
        this.logger.warn('Немає жодного admin-користувача — email-сповіщення про модерацію пропущено');
        return;
      }

      const photos = await this.media.find({ where: { listingId: listing.id }, order: { sortOrder: 'ASC' } });
      const photoUrls = await Promise.all(
        photos.slice(0, MAX_PHOTOS_IN_EMAIL).map((p) => this.storage.getSignedUrl(p.storageKey)),
      );

      const approveUrl = this.buildActionUrl(moderationCase.id, 'APPROVED', moderator.id, secret);
      const rejectUrl = this.buildActionUrl(moderationCase.id, 'REJECTED', moderator.id, secret);

      await this.email.send(
        to,
        `На модерації: ${listing.title}`,
        this.buildHtml(listing, moderationCase, photoUrls, approveUrl, rejectUrl),
      );
    } catch (err) {
      // Best-effort — збій відправки email не має ламати публікацію оголошення власником.
      this.logger.error(`Не вдалось надіслати email про модерацію: ${(err as Error).message}`);
    }
  }

  /**
   * FIXED_OTP_PHONE — той самий номер, для якого auth.service.ts вже має постійний OTP-код
   * (власник проєкту сам собі адмін) — надійніший якір для "хто вирішує з листа", ніж
   * "перший admin за датою реєстрації", яку легко переплутати з другим доданим адміном
   * (+380631670509, доданий пізніше).
   */
  private async resolveModerator(): Promise<User | null> {
    const fixedPhone = this.config.get<string>('FIXED_OTP_PHONE');
    if (fixedPhone) {
      const byPhone = await this.users.findOne({ where: { phone: fixedPhone, role: 'admin' } });
      if (byPhone) return byPhone;
    }
    return this.users.findOne({ where: { role: 'admin' }, order: { createdAt: 'ASC' } });
  }

  /** Перевіряє HMAC-підпис токена з посилання в листі. Повертає null для невалідного/підробленого токена. */
  verifyToken(token: string): ModerationEmailAction | null {
    const secret = this.config.get<string>('MODERATION_EMAIL_SECRET');
    if (!secret) return null;

    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) return null;

    const expected = createHmac('sha256', secret).update(payloadB64).digest('hex');
    const signatureBuf = Buffer.from(signature, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    if (signatureBuf.length !== expectedBuf.length || !timingSafeEqual(signatureBuf, expectedBuf)) {
      return null;
    }

    try {
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
      if (!payload.c || !payload.d || !payload.m) return null;
      return { caseId: payload.c, decision: payload.d, moderatorId: payload.m };
    } catch {
      return null;
    }
  }

  private buildActionUrl(caseId: string, decision: ModerationDecision, moderatorId: string, secret: string): string {
    const apiUrl = (this.config.get<string>('API_PUBLIC_URL') ?? 'http://localhost:3001').replace(/\/$/, '');
    const payloadB64 = Buffer.from(JSON.stringify({ c: caseId, d: decision, m: moderatorId })).toString('base64url');
    const signature = createHmac('sha256', secret).update(payloadB64).digest('hex');
    return `${apiUrl}/api/v1/moderation-email/action?t=${payloadB64}.${signature}`;
  }

  private buildHtml(
    listing: Listing,
    moderationCase: ModerationCase,
    photoUrls: string[],
    approveUrl: string,
    rejectUrl: string,
  ): string {
    const photosHtml = photoUrls
      .map((url) => `<img src="${escapeHtml(url)}" width="200" style="margin:4px;border-radius:8px;" alt="" />`)
      .join('');
    const flagHtml = moderationCase.autoFlagReason
      ? `<p style="color:#b91c1c;"><strong>Причина перевірки:</strong> ${escapeHtml(moderationCase.autoFlagReason)}</p>`
      : '';

    return `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="margin-bottom:4px;">${escapeHtml(listing.title)}</h2>
        <p style="margin:4px 0;"><strong>Ціна:</strong> ${listing.price ?? '—'} ${escapeHtml(listing.currency)}</p>
        <p style="margin:4px 0;white-space:pre-wrap;"><strong>Опис:</strong> ${escapeHtml(listing.description ?? '—')}</p>
        ${flagHtml}
        <div style="margin:12px 0;">${photosHtml || '<p><em>Без фото</em></p>'}</div>
        <div style="margin-top:20px;">
          <a href="${approveUrl}" style="display:inline-block;padding:12px 24px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px;margin-right:12px;font-weight:bold;">✅ Схвалити</a>
          <a href="${rejectUrl}" style="display:inline-block;padding:12px 24px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">❌ Відхилити</a>
        </div>
      </div>
    `;
  }
}

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}
