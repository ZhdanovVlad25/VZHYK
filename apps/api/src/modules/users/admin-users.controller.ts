import { Controller, Get, Ip, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../shared/decorators/current-user.decorator';

/** docs/api.md §12 — лише admin (не moderator): блокування облікових записів — чутливіша дія за модерацію контенту. */
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  @Get()
  search(@Query('search') search?: string) {
    return this.adminUsers.search(search);
  }

  @Get(':id')
  getDetail(@Param('id') id: string) {
    return this.adminUsers.getDetail(id);
  }

  @Post(':id/block')
  block(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Ip() ip: string) {
    return this.adminUsers.block(actor.id, id, ip);
  }

  @Post(':id/unblock')
  unblock(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Ip() ip: string) {
    return this.adminUsers.unblock(actor.id, id, ip);
  }
}
