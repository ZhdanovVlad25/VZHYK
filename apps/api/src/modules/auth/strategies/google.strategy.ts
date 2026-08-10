import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

/**
 * Google OAuth (Authorization Code flow), docs/security.md §1.
 * Каркас Phase 1 — реальні credentials підключаються через .env (GOOGLE_OAUTH_*).
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('GOOGLE_OAUTH_CLIENT_ID') || 'dev_only_google_client_id',
      clientSecret: config.get<string>('GOOGLE_OAUTH_CLIENT_SECRET') || 'dev_only_google_client_secret',
      callbackURL: config.get<string>(
        'GOOGLE_OAUTH_CALLBACK_URL',
        'http://localhost:3001/api/v1/auth/google/callback',
      ),
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: { id: string; emails?: { value: string }[]; displayName?: string },
    done: VerifyCallback,
  ) {
    const user = {
      googleId: profile.id,
      email: profile.emails?.[0]?.value ?? null,
      displayName: profile.displayName ?? null,
    };
    done(null, user);
  }
}
