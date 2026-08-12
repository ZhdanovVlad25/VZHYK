import { Body, Controller, Get, Ip, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../shared/decorators/current-user.decorator';

/** docs/api.md §12 — moderator/admin, як і admin/moderation. */
@Controller('admin/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('moderator', 'admin')
export class AdminReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  list(@Query('status') status?: string, @Query('targetType') targetType?: string) {
    return this.reports.adminList(status, targetType);
  }

  @Post(':id/resolve')
  resolve(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ResolveReportDto,
    @Ip() ip: string,
  ) {
    return this.reports.resolve(actor.id, id, dto.status, ip);
  }
}
