import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { REPORT_REASONS, REPORT_TARGET_TYPES, ReportReason, ReportTargetType } from '../report.constants';
import { IsUuidLike } from '../../../shared/validators/is-uuid-like.decorator';

export class CreateReportDto {
  @IsIn(REPORT_TARGET_TYPES)
  targetType: ReportTargetType;

  @IsUuidLike()
  targetId: string;

  @IsIn(REPORT_REASONS)
  reason: ReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
