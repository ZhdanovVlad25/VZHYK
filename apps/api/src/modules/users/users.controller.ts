import { Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ProfilesService } from '../profiles/profiles.service';

/** docs/api.md §3 Users & Profiles — публічний профіль продавця. */
@Controller('users')
export class UsersController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get(':id/public-profile')
  // Телефон у відповіді (MUST-аудит: без нього купувати доводилось спершу реєструватись) —
  // тугіший ліміт, ніж глобальний 100/хв (app.module.ts), саме на цьому маршруті.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  publicProfile(@Param('id') id: string) {
    return this.profiles.getPublicProfile(id);
  }
}
