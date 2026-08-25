import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConsoleEmailProvider } from './console-email.provider';
import { GmailSmtpProvider } from './gmail-smtp.provider';
import { EMAIL_PROVIDER_TOKEN } from './email-provider.interface';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: EMAIL_PROVIDER_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        switch (config.get<string>('EMAIL_PROVIDER')) {
          case 'gmail':
            return new GmailSmtpProvider(config);
          default:
            return new ConsoleEmailProvider();
        }
      },
    },
  ],
  exports: [EMAIL_PROVIDER_TOKEN],
})
export class EmailModule {}
