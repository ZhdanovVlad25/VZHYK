import { Body, Controller, Delete, Get, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ProfilesService } from './profiles.service';
import { ListingsService } from '../listings/listings.service';
import { FavoritesService } from '../favorites/favorites.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { MAX_MEDIA_SIZE_BYTES } from '../media/media.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../shared/decorators/current-user.decorator';

/** docs/api.md §3 Users & Profiles — власний профіль (лише автентифіковані). */
@Controller('profiles')
@UseGuards(JwtAuthGuard)
export class ProfilesController {
  constructor(
    private readonly profiles: ProfilesService,
    private readonly listings: ListingsService,
    private readonly favorites: FavoritesService,
  ) {}

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.profiles.getOwnView(user.id);
  }

  @Get('me/stats')
  async stats(@CurrentUser() user: AuthenticatedUser) {
    const [listingStats, favoritesCount, memberSince] = await Promise.all([
      this.listings.getOwnStats(user.id),
      this.favorites.count(user.id),
      this.profiles.getMemberSince(user.id),
    ]);
    return { ...listingStats, favoritesCount, memberSince };
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.profiles.updateOwnView(user.id, dto);
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_MEDIA_SIZE_BYTES } }))
  uploadAvatar(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file: Express.Multer.File | undefined) {
    return this.profiles.updateAvatar(user.id, file);
  }

  @Delete('me/avatar')
  removeAvatar(@CurrentUser() user: AuthenticatedUser) {
    return this.profiles.removeAvatar(user.id);
  }

  @Get('me/listings')
  myListings(@CurrentUser() user: AuthenticatedUser, @Query('status') status?: string) {
    return this.listings.findOwnListings(user.id, status);
  }
}
