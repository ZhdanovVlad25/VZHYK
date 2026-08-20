import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';
import { requireEnv } from '../../shared/env';
import { SmsProvider } from './sms-provider.interface';

@Injectable()
export class TwilioSmsProvider implements SmsProvider {
  private readonly logger = new Logger(TwilioSmsProvider.name);
  private readonly client: Twilio;
  private readonly fromNumber: string;

  constructor(config: ConfigService) {
    const accountSid = requireEnv(config, 'TWILIO_ACCOUNT_SID');
    const authToken = requireEnv(config, 'TWILIO_AUTH_TOKEN');
    this.fromNumber = requireEnv(config, 'TWILIO_FROM_NUMBER');
    this.client = new Twilio(accountSid, authToken);
  }

  async send(phone: string, message: string): Promise<void> {
    await this.client.messages.create({ to: phone, from: this.fromNumber, body: message });
    // Не логуємо message (містить код підтвердження) — лише факт відправки.
    this.logger.log(`[sms:twilio] sent to ${phone}`);
  }
}
