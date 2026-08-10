import { Controller, Get, Param } from '@nestjs/common';
import { ProfilesService } from '../profiles/profiles.service';

/** docs/api.md §3 Users & Profiles — публічний профіль продавця. */
@Controller('users')
export class UsersController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get(':id/public-profile')
  publicProfile(@Param('id') id: string) {
    return this.profiles.getPublicProfile(id);
  }
}
