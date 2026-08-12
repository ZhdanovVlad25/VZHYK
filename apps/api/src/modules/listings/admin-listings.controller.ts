import { Body, Controller, Get, Ip, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AdminListingsService } from './admin-listings.service';
import { AdminUpdateListingDto } from './dto/admin-update-listing.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../shared/decorators/current-user.decorator';

/** docs/api.md §12 — лише admin (не moderator), як і admin/users та admin/audit-log. */
@Controller('admin/listings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminListingsController {
  constructor(private readonly adminListings: AdminListingsService) {}

  @Get()
  search(@Query('search') search?: string, @Query('status') status?: string) {
    return this.adminListings.search(search, status);
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AdminUpdateListingDto,
    @Ip() ip: string,
  ) {
    return this.adminListings.update(actor.id, id, dto, ip);
  }
}
