import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
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
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: this.fromAddress, pass: appPassword },
    });
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    await this.transporter.sendMail({ from: this.fromAddress, to, subject, html });
    this.logger.log(`[email:gmail] sent to ${to}: ${subject}`);
  }
}
