import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConsoleSmsProvider } from './console-sms.provider';
import { TwilioSmsProvider } from './twilio-sms.provider';
import { TurboSmsProvider } from './turbosms-sms.provider';
import { SMS_PROVIDER_TOKEN } from './sms-provider.interface';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: SMS_PROVIDER_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        switch (config.get<string>('SMS_PROVIDER')) {
          case 'twilio':
            return new TwilioSmsProvider(config);
          case 'turbosms':
            return new TurboSmsProvider(config);
          default:
            return new ConsoleSmsProvider();
        }
      },
    },
  ],
  exports: [SMS_PROVIDER_TOKEN],
})
export class SmsModule {}
