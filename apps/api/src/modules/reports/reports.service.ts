import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Report } from './report.entity';
import { Listing } from '../listings/listing.entity';
import { User } from '../users/user.entity';
import { ChatParticipant } from '../chat/chat-participant.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { RiskService } from '../risk/risk.service';

/** docs/api.md §10 Reports — створення скарги + перелік своїх. Черга модерації — окремо, пізніше. */
@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report) private readonly reports: Repository<Report>,
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(ChatParticipant) private readonly chatParticipants: Repository<ChatParticipant>,
    private readonly risk: RiskService,
  ) {}

  async create(reporterId: string, dto: CreateReportDto): Promise<Report> {
    await this.assertTargetExists(reporterId, dto.targetType, dto.targetId);

    const saved = await this.reports.save(
      this.reports.create({
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
        description: dto.description ?? null,
      }),
    );

    /** CHAT-скарги пропускаємо — учасників двоє, неоднозначно, хто винен. */
    const reportedUserId = await this.resolveReportedUserId(dto.targetType, dto.targetId);
    if (reportedUserId) {
      await this.risk.checkHighReportCount(reportedUserId);
    }

    return saved;
  }

  private async resolveReportedUserId(targetType: CreateReportDto['targetType'], targetId: string): Promise<string | null> {
    if (targetType === 'USER') {
      return targetId;
    }
    if (targetType === 'LISTING') {
      const listing = await this.listings.findOne({ where: { id: targetId } });
      return listing?.userId ?? null;
    }
    return null;
  }

  list(reporterId: string): Promise<Report[]> {
    return this.reports.find({ where: { reporterId }, order: { createdAt: 'DESC' } });
  }

  private async assertTargetExists(reporterId: string, targetType: CreateReportDto['targetType'], targetId: string): Promise<void> {
    if (targetType === 'LISTING') {
      const listing = await this.listings.findOne({ where: { id: targetId, deletedAt: IsNull() } });
      if (!listing) {
        throw new NotFoundException({ code: 'LISTING_NOT_FOUND', message: 'Оголошення не знайдено' });
      }
      return;
    }

    if (targetType === 'USER') {
      const user = await this.users.findOne({ where: { id: targetId, deletedAt: IsNull() } });
      if (!user) {
        throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Користувача не знайдено' });
      }
      return;
    }

    /** targetType === 'CHAT': та сама логіка приховування існування, що й у ChatsService — скаржитись можна лише на свій чат. */
    const participant = await this.chatParticipants.findOne({ where: { chatId: targetId, userId: reporterId } });
    if (!participant) {
      throw new NotFoundException({ code: 'CHAT_NOT_FOUND', message: 'Чат не знайдено' });
    }
  }
}
