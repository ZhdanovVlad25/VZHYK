import { Body, Controller, Get, Ip, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { DecideCaseDto } from './dto/decide-case.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../shared/decorators/current-user.decorator';
import { MODERATION_CASE_STATUSES, ModerationCaseStatus } from './moderation.constants';

/** docs/api.md §12 Admin — черга модерації. RolesGuard локально на контролері, не глобально (roadmap grabli #3). */
@Controller('admin/moderation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('moderator', 'admin')
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Get('queue')
  queue(@Query('status') status?: string) {
    const normalized = status?.toUpperCase();
    const validStatus = normalized && (MODERATION_CASE_STATUSES as readonly string[]).includes(normalized)
      ? (normalized as ModerationCaseStatus)
      : undefined;
    return this.moderation.findQueue(validStatus);
  }

  @Post(':caseId/decide')
  decide(@CurrentUser() user: AuthenticatedUser, @Param('caseId') caseId: string, @Body() dto: DecideCaseDto, @Ip() ip: string) {
    return this.moderation.decide(user.id, caseId, dto.decision, ip);
  }
}
