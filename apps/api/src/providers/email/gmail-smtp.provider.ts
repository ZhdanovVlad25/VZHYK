import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { requireEnv } from '../../shared/env';
import { EmailProvider } from './email-provider.interface';

@Injectable()
export class GmailSmtpProvider implements EmailProvider {
  private readonly logger = new Logger(GmailSmtpProvider.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly fromAddress: string;

  constructor(config: ConfigService) {
    this.fromAddress = requireEnv(config, 'GMAIL_USER');
    const appPassword = requireEnv(config, 'GMAIL_APP_PASSWORD');
    // family: 4 — деякі контейнерні мережі (Railway включно) резолвлять smtp.gmail.com в
    // AAAA (IPv6), але не мають робочого IPv6-маршруту назовні: з'єднання не відхиляється
    // одразу, а висить хвилинами до таймауту. Форсуємо IPv4, де маршрут точно є.
    // `family` не входить у типізацію SMTPTransport.Options, хоч nodemailer передає його
    // далі в net.connect() — тому cast через unknown замість "as SMTPTransport.Options" напряму.
    const options = {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: this.fromAddress, pass: appPassword },
      family: 4,
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 15_000,
    } as unknown as SMTPTransport.Options;
    this.transporter = nodemailer.createTransport(options);
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    await this.transporter.sendMail({ from: this.fromAddress, to, subject, html });
    this.logger.log(`[email:gmail] sent to ${to}: ${subject}`);
  }
}
