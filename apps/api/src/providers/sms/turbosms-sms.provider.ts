import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { requireEnv } from '../../shared/env';
import { SmsProvider } from './sms-provider.interface';

const TURBOSMS_API_URL = 'https://api.turbosms.ua/message/send.json';

interface TurboSmsResponse {
  response_code: number;
  response_result?: { phone: string; response_code: number; message_id: string | null }[];
}

/** Український SMS-шлюз — пряма маршрутизація через укр. операторів, дешевше за Twilio для +380. */
@Injectable()
export class TurboSmsProvider implements SmsProvider {
  private readonly logger = new Logger(TurboSmsProvider.name);
  private readonly token: string;
  private readonly sender: string;

  constructor(config: ConfigService) {
    this.token = requireEnv(config, 'TURBOSMS_TOKEN');
    this.sender = requireEnv(config, 'TURBOSMS_SENDER');
  }

  async send(phone: string, message: string): Promise<void> {
    // TurboSMS очікує номер у форматі 380XXXXXXXXX, без "+".
    const recipient = phone.replace(/^\+/, '');

    const res = await fetch(TURBOSMS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
      body: JSON.stringify({ recipients: [recipient], sms: { sender: this.sender, text: message } }),
    });
    const data = (await res.json()) as TurboSmsResponse;
    const result = data.response_result?.[0];
    const failed = !res.ok || data.response_code !== 0 || !result || result.response_code !== 0 || !result.message_id;

    if (failed) {
      // Не логуємо message (містить код підтвердження), лише статус помилки.
      this.logger.error(`[sms:turbosms] failed for ${phone}: code=${data.response_code} result=${result?.response_code}`);
      throw new InternalServerErrorException('Не вдалося надіслати SMS.');
    }
    this.logger.log(`[sms:turbosms] sent to ${phone}`);
  }
}
