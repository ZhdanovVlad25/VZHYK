import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ProfilesService } from '../profiles/profiles.service';
import { OptionalJwtAuthGuard } from '../../shared/guards/optional-jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../shared/decorators/current-user.decorator';

/** docs/api.md §3 Users & Profiles — публічний профіль продавця. */
@Controller('users')
export class UsersController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get(':id/public-profile')
  @UseGuards(OptionalJwtAuthGuard)
  publicProfile(@CurrentUser() user: AuthenticatedUser | undefined, @Param('id') id: string) {
    return this.profiles.getPublicProfile(id, user?.id);
  }
}
