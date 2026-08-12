import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, IsNull, OptimisticLockVersionMismatchError, Repository } from 'typeorm';
import { Listing } from './listing.entity';
import { AdminUpdateListingDto } from './dto/admin-update-listing.dto';
import { LISTING_STATUSES, ListingStatus } from './listing.constants';
import { SEARCH_PROVIDER, SearchProvider } from '../../providers/search/search-provider.interface';
import { AuditLogService } from '../audit-log/audit-log.service';

/** docs/api.md §12 GET/PATCH /admin/listings — пошук з фільтрами модерації + редагування/блокування. */
@Injectable()
export class AdminListingsService {
  constructor(
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    @Inject(SEARCH_PROVIDER) private readonly searchProvider: SearchProvider,
    private readonly auditLog: AuditLogService,
  ) {}

  async search(search?: string, status?: string): Promise<Listing[]> {
    const where: FindOptionsWhere<Listing> = { deletedAt: IsNull() };

    if (search) {
      where.title = ILike(`%${search}%`);
    }

    if (status) {
      const normalized = status.toUpperCase() as ListingStatus;
      if (!LISTING_STATUSES.includes(normalized)) {
        throw new BadRequestException({ code: 'LISTING_STATUS_INVALID', message: `Невідомий статус: ${status}` });
      }
      where.status = normalized;
    }

    return this.listings.find({ where, order: { createdAt: 'DESC' }, take: 50 });
  }

  /**
   * Адмінське редагування/блокування — на відміну від власницького update() не бере на
   * себе повну state machine: status приймає лише BLOCKED (з будь-якого нетермінального
   * статусу) або ACTIVE (лише як розблокування, тобто з BLOCKED). Контентні поля можна
   * міняти незалежно від статусу — адмін не обмежений владельницькою забороною
   * SOLD/ARCHIVED/BLOCKED-не-редагувати.
   */
  async update(actorId: string, id: string, dto: AdminUpdateListingDto, ip: string | null): Promise<Listing> {
    const listing = await this.listings.findOne({ where: { id, deletedAt: IsNull() } });
    if (!listing) {
      throw new NotFoundException({ code: 'LISTING_NOT_FOUND', message: 'Оголошення не знайдено' });
    }

    const before = {
      status: listing.status,
      title: listing.title,
      description: listing.description,
      price: listing.price,
      currency: listing.currency,
    };

    if (dto.status !== undefined) {
      if (dto.status === 'BLOCKED') {
        if (listing.status === 'BLOCKED') {
          throw new BadRequestException({ code: 'LISTING_ALREADY_BLOCKED', message: 'Оголошення вже заблоковано' });
        }
        listing.status = 'BLOCKED';
      } else {
        if (listing.status !== 'BLOCKED') {
          throw new BadRequestException({
            code: 'LISTING_NOT_BLOCKED',
            message: 'Розблокувати можна лише заблоковане оголошення',
          });
        }
        listing.status = 'ACTIVE';
      }
    }

    Object.assign(listing, {
      title: dto.title ?? listing.title,
      description: dto.description ?? listing.description,
      price: dto.price ?? listing.price,
      currency: dto.currency ?? listing.currency,
    });

    const saved = await this.saveWithConflictHandling(listing);

    if (dto.status === 'BLOCKED') {
      await this.searchProvider.remove(saved.id);
    } else if (dto.status === 'ACTIVE') {
      await this.searchProvider.index(saved.id);
    }

    await this.auditLog.record({
      actorUserId: actorId,
      action: 'listing.admin_update',
      targetType: 'listing',
      targetId: saved.id,
      before,
      after: {
        status: saved.status,
        title: saved.title,
        description: saved.description,
        price: saved.price,
        currency: saved.currency,
      },
      ip,
    });

    return saved;
  }

  private async saveWithConflictHandling(listing: Listing): Promise<Listing> {
    try {
      return await this.listings.save(listing);
    } catch (err) {
      if (err instanceof OptimisticLockVersionMismatchError) {
        throw new ConflictException({
          code: 'LISTING_CONFLICT',
          message: 'Оголошення було змінено в іншому запиті, оновіть сторінку і спробуйте ще раз',
        });
      }
      throw err;
    }
  }
}
