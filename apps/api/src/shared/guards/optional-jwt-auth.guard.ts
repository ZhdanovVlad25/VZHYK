import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Як JwtAuthGuard, але не блокує запит без токена (чи з невалідним токеном) —
 * заповнює request.user, якщо він валідний, інакше залишає undefined.
 * Для public-ендпоінтів, поведінка яких залежить від того, чи це власник
 * (напр. GET /listings/:id показує чернетку лише її автору).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(_err: unknown, user: TUser): TUser {
    return (user || undefined) as TUser;
  }
}
