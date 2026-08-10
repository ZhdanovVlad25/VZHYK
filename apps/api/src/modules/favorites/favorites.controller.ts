import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../shared/decorators/current-user.decorator';

/** docs/api.md §8 Favorites & Saved Searches. */
@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Post(':listingId')
  add(@CurrentUser() user: AuthenticatedUser, @Param('listingId') listingId: string) {
    return this.favorites.add(user.id, listingId);
  }

  @Delete(':listingId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('listingId') listingId: string) {
    await this.favorites.remove(user.id, listingId);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.favorites.list(user.id);
  }
}
