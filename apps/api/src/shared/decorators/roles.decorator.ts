import { SetMetadata } from '@nestjs/common';

/** Ролі згідно docs/security.md §2: guest, user, moderator, admin, system */
export type Role = 'guest' | 'user' | 'moderator' | 'admin' | 'system';

export const ROLES_KEY = 'roles';

/** @Roles('admin', 'moderator') на контролері/методі — RBAC foundation. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
