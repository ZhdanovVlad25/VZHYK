import { Injectable, Logger } from '@nestjs/common';
import { EmailProvider } from './email-provider.interface';

/** MVP/dev: тема листа у stdout замість реальної відправки. Ніколи не використовувати для реальних сповіщень. */
@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ConsoleEmailProvider.name);

  async send(to: string, subject: string): Promise<void> {
    this.logger.log(`[email:console] ${to} -> ${subject}`);
  }
}
