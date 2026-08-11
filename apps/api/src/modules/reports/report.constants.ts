export const REPORT_TARGET_TYPES = ['LISTING', 'USER', 'CHAT'] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_REASONS = ['SPAM', 'FRAUD', 'PROHIBITED_ITEM', 'OFFENSIVE_CONTENT', 'DUPLICATE', 'OTHER'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ['PENDING', 'REVIEWING', 'RESOLVED', 'REJECTED'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
