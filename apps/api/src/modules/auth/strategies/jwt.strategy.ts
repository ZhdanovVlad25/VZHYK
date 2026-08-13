import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User } from '../../users/user.entity';
import { requireEnv } from '../../../shared/env';

export interface JwtPayload {
  sub: string;
  role: string;
  phone?: string | null;
}

/**
 * Перевіряє access token (15 хв TTL, docs/security.md §1). Роль/телефон читаються з
 * payload (без DB-запиту, стандартний stateless JWT), але status — окремий DB-запит
 * на кожен захищений виклик: JWT сам по собі не revoke-ується, тож без цього
 * заблокований користувач лишався б валідним аж до сплину TTL токена (до 15 хв).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requireEnv(config, 'JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException({
        code: 'USER_BLOCKED',
        message: 'Обліковий запис заблоковано',
      });
    }

    // "Останній раз онлайн" для публічного профілю (profiles.service.ts). Fire-and-forget +
    // троттлінг 2 хв — інакше писали б у БД на КОЖЕН авторизований запит.
    const ONLINE_STALE_MS = 2 * 60 * 1000;
    if (!user.lastActiveAt || Date.now() - user.lastActiveAt.getTime() > ONLINE_STALE_MS) {
      this.users.update(user.id, { lastActiveAt: new Date() }).catch(() => undefined);
    }

    return {
      id: payload.sub,
      role: payload.role,
      phone: payload.phone ?? null,
    };
  }
}
