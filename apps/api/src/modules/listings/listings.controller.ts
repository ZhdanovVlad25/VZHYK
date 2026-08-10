import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../shared/guards/optional-jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../shared/decorators/current-user.decorator';

/**
 * docs/api.md §5 Listings — CRUD і state-machine actions. `GET /listings`
 * (список з фільтрами) та `/similar` — проксі до Search-модуля (Phase 2, окремо).
 * Media upload pipeline — окремий наступний крок.
 */
@Controller('listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateListingDto) {
    return this.listings.create(user.id, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateListingDto) {
    return this.listings.update(user.id, id, dto);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard)
  publish(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.listings.publish(user.id, id);
  }

  @Post(':id/archive')
  @UseGuards(JwtAuthGuard)
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.listings.archive(user.id, id);
  }

  @Post(':id/mark-sold')
  @UseGuards(JwtAuthGuard)
  markSold(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.listings.markSold(user.id, id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.listings.remove(user.id, id);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  findOne(@CurrentUser() user: AuthenticatedUser | undefined, @Param('id') id: string) {
    return this.listings.findVisible(id, user?.id);
  }

  @Get(':id/price-history')
  @UseGuards(OptionalJwtAuthGuard)
  priceHistory(@CurrentUser() user: AuthenticatedUser | undefined, @Param('id') id: string) {
    return this.listings.getPriceHistory(id, user?.id);
  }
}
