export const MODERATION_CASE_STATUSES = ['PENDING', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED'] as const;
export type ModerationCaseStatus = (typeof MODERATION_CASE_STATUSES)[number];

/** Рішення модератора на POST /admin/moderation/:caseId/decide (docs/api.md §12). */
export const MODERATION_DECISIONS = ['APPROVED', 'REJECTED', 'NEEDS_REVIEW'] as const;
export type ModerationDecision = (typeof MODERATION_DECISIONS)[number];

/**
 * Заглушка-словник для авто-флагу (Phase 4 checklist: "auto-rules (заборонені слова,
 * дублікати)"). Дублікати не реалізовані — потребують fuzzy-порівняння заголовків, це
 * окрема задача. Список навмисно короткий і демонстраційний, не production-словник.
 */
export const BANNED_WORDS = ['зброя', 'наркотик', 'вкрадене', 'краденої', 'краденим'];
