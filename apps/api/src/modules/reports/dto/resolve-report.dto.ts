import { IsIn } from 'class-validator';

export const REPORT_RESOLUTION_STATUSES = ['REVIEWING', 'RESOLVED', 'REJECTED'] as const;
export type ReportResolutionStatus = (typeof REPORT_RESOLUTION_STATUSES)[number];

export class ResolveReportDto {
  @IsIn(REPORT_RESOLUTION_STATUSES)
  status: ReportResolutionStatus;
}
