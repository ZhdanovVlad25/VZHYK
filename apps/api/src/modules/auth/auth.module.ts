import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService, REFRESH_JWT_SERVICE } from './auth.service';
import { AuthController } from './auth.controller';
import { OtpCode } from './otp-code.entity';
import { User } from '../users/user.entity';
import { Profile } from '../profiles/profile.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { requireEnv } from '../../shared/env';
import { SmsModule } from '../../providers/sms/sms.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, OtpCode, Profile]),
    PassportModule,
    ConfigModule,
    SmsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: requireEnv(config, 'JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    // Окремий секрет (JWT_REFRESH_SECRET) від access-токена — інакше refresh-токен,
    // підписаний тим самим ключем, що й access, працював би як access-токен на будь-якому
    // захищеному ендпоінті (перевіряється лише підпис+expiry, не "тип" токена).
    {
      provide: REFRESH_JWT_SERVICE,
      useFactory: (config: ConfigService) => new JwtService({ secret: requireEnv(config, 'JWT_REFRESH_SECRET') }),
      inject: [ConfigService],
    },
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
