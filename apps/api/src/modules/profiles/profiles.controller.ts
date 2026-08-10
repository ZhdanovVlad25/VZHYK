import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { ListingsService } from '../listings/listings.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../shared/decorators/current-user.decorator';

/** docs/api.md §3 Users & Profiles — власний профіль (лише автентифіковані). */
@Controller('profiles')
@UseGuards(JwtAuthGuard)
export class ProfilesController {
  constructor(
    private readonly profiles: ProfilesService,
    private readonly listings: ListingsService,
  ) {}

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.profiles.getOrCreateOwn(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.profiles.updateOwn(user.id, dto);
  }

  @Get('me/listings')
  myListings(@CurrentUser() user: AuthenticatedUser, @Query('status') status?: string) {
    return this.listings.findOwnListings(user.id, status);
  }
}
