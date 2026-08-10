import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, Role } from '../decorators/roles.decorator';

/**
 * Guard-based RBAC (docs/security.md §2). Перевіряє, чи роль користувача
 * (встановлена JwtAuthGuard у request.user.role) входить у @Roles(...) на handler/class.
 * Ownership-перевірки (напр. "лише власник оголошення") виконуються окремо в domain service.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ROLE',
        message: 'Недостатньо прав для цієї дії',
      });
    }
    return true;
  }
}
