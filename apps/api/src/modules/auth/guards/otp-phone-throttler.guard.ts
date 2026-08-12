import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * docs/security.md §1/§6 — OTP rate limits ("3/15хв на номер") мають трекатись за
 * номером телефону, не за IP (дефолтна поведінка ThrottlerGuard). Зареєстрований як
 * ЄДИНИЙ глобальний APP_GUARD (app.module.ts) — навмисно НЕ стекається з окремим
 * @UseGuards() на маршруті: два різні guard-класи на одному хендлері обидва читають ту
 * саму @Throttle() метадату незалежно одне від одного, тож звичайний global
 * ThrottlerGuard (IP-tracked) все одно душив би otp/request/verify своїм власним
 * IP-лічильником раніше, ніж встигав спрацювати цей клас — перевірено на integration-тестах.
 * Guards виконуються до ValidationPipe (middleware → guards → pipes → handler), тож
 * req.body.phone уже доступний як сирий JSON-body до трансформації DTO. Для решти
 * маршрутів (без body.phone) поведінка ідентична звичайному IP-based ThrottlerGuard.
 */
@Injectable()
export class OtpPhoneThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const body = req.body as { phone?: string } | undefined;
    return body?.phone ?? (req.ip as string);
  }
}
