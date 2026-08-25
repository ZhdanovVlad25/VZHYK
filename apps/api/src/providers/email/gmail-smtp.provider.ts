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
    // Короткі таймаути — нехай впаде швидко й помітно в логах, а не висить хвилинами.
    // IPv6-connectivity фікс — окремо, глобально для процесу (main.ts setDefaultResultOrder;
    // nodemailer не форвардить власний `family` в підключення, тестовано наживо).
    const options: SMTPTransport.Options = {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: this.fromAddress, pass: appPassword },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 15_000,
    };
    this.transporter = nodemailer.createTransport(options);
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    await this.transporter.sendMail({ from: this.fromAddress, to, subject, html });
    this.logger.log(`[email:gmail] sent to ${to}: ${subject}`);
  }
}
