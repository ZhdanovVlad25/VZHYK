import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider } from './sms-provider.interface';

/** MVP/dev: код у stdout замість реального SMS. Ніколи не використовувати для реальних користувачів. */
@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  async send(phone: string, message: string): Promise<void> {
    this.logger.log(`[sms:console] ${phone} -> ${message}`);
  }
}
