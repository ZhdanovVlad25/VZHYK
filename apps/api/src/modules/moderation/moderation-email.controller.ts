import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ModerationEmailService } from './moderation-email.service';
import { ModerationService } from './moderation.service';

/**
 * Публічний (без JwtAuthGuard/RolesGuard, на відміну від ModerationController) — клік по
 * посиланню з email-клієнта не може нести Authorization header. Захист — HMAC-підпис у
 * токені (ModerationEmailService.verifyToken), не автентифікація.
 */
@Controller('moderation-email')
export class ModerationEmailController {
  constructor(
    private readonly moderationEmail: ModerationEmailService,
    private readonly moderation: ModerationService,
  ) {}

  @Get('action')
  async action(@Query('t') token: string | undefined, @Res() res: Response): Promise<void> {
    const parsed = token ? this.moderationEmail.verifyToken(token) : null;
    if (!parsed) {
      res.type('html').status(400).send(renderPage('Невірне або застаріле посилання', '#dc2626'));
      return;
    }

    try {
      await this.moderation.decide(parsed.moderatorId, parsed.caseId, parsed.decision, null);
    } catch (err) {
      const response = typeof (err as { getResponse?: () => unknown })?.getResponse === 'function'
        ? (err as { getResponse: () => { message?: string } }).getResponse()
        : null;
      const message = response?.message ?? (err instanceof Error ? err.message : 'Не вдалося обробити рішення');
      res.type('html').status(400).send(renderPage(message, '#dc2626'));
      return;
    }

    const label = parsed.decision === 'APPROVED' ? 'Оголошення схвалено ✅' : 'Оголошення відхилено ❌';
    res.type('html').status(200).send(renderPage(label, '#16a34a'));
  }
}

function renderPage(message: string, color: string): string {
  return `<!doctype html><html lang="uk"><head><meta charset="utf-8"><title>Вжик — модерація</title></head><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f9fafb;"><h1 style="color:${color};text-align:center;padding:0 20px;">${message}</h1></body></html>`;
}
