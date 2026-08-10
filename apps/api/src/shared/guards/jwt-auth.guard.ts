import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Перевіряє access token (JWT) і заповнює request.user. Див. modules/auth/strategies/jwt.strategy.ts */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
