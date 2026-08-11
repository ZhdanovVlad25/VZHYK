import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { User } from './user.entity';
import { AuditLogService } from '../audit-log/audit-log.service';

export interface AdminUserView {
  id: string;
  phone: string | null;
  email: string | null;
  role: string;
  status: string;
  createdAt: Date;
}

/** docs/api.md §12 Admin — пошук/блокування користувачів. */
@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly auditLog: AuditLogService,
  ) {}

  async search(query?: string): Promise<AdminUserView[]> {
    const where = query ? [{ phone: ILike(`%${query}%`) }, { email: ILike(`%${query}%`) }] : {};
    const found = await this.users.find({ where, order: { createdAt: 'DESC' }, take: 50 });
    return found.map((u) => ({ id: u.id, phone: u.phone, email: u.email, role: u.role, status: u.status, createdAt: u.createdAt }));
  }

  async block(actorId: string, targetId: string, ip: string | null): Promise<AdminUserView> {
    return this.setStatus(actorId, targetId, 'blocked', 'user.block', ip);
  }

  async unblock(actorId: string, targetId: string, ip: string | null): Promise<AdminUserView> {
    return this.setStatus(actorId, targetId, 'active', 'user.unblock', ip);
  }

  private async setStatus(
    actorId: string,
    targetId: string,
    status: 'active' | 'blocked',
    action: string,
    ip: string | null,
  ): Promise<AdminUserView> {
    if (actorId === targetId) {
      throw new BadRequestException({ code: 'USER_CANNOT_SELF_BLOCK', message: 'Не можна заблокувати самого себе' });
    }

    const user = await this.users.findOne({ where: { id: targetId } });
    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Користувача не знайдено' });
    }

    const before = { status: user.status };
    user.status = status;
    const saved = await this.users.save(user);

    await this.auditLog.record({
      actorUserId: actorId,
      action,
      targetType: 'user',
      targetId,
      before,
      after: { status: saved.status },
      ip,
    });

    return { id: saved.id, phone: saved.phone, email: saved.email, role: saved.role, status: saved.status, createdAt: saved.createdAt };
  }
}
