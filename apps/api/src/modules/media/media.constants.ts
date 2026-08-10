/** Той самий набір статусів, що moderation_cases.status (docs/database.md §2) — узгоджено з Phase 4 pipeline. */
export const MEDIA_MODERATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'NEEDS_REVIEW'] as const;
export type MediaModerationStatus = (typeof MEDIA_MODERATION_STATUSES)[number];
