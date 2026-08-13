import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Profile } from './profile.entity';
import { User } from '../users/user.entity';
import { Location } from '../location/location.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

export interface PublicProfile {
  userId: string;
  displayName: string | null;
  username: string | null;
  avatarMediaId: string | null;
  cityLocationId: string | null;
  bio: string | null;
  rating: number | null;
  reviewsCount: number | null;
  activeListingsCount: number;
  memberSince: Date;
  lastActiveAt: Date | null;
  /** Тільки для авторизованих запитів (users.controller.ts OptionalJwtAuthGuard) — не віддаємо анонімно, щоб номер не збирали скрейпери. */
  phone: string | null;
}

/** docs/api.md §3 Users & Profiles. */
@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Location) private readonly locations: Repository<Location>,
  ) {}

  /** Профіль не створюється при реєстрації (Profiles module ще не існував у Phase 1) — lazy-create при першому зверненні. */
  async getOrCreateOwn(userId: string): Promise<Profile> {
    const existing = await this.profiles.findOne({ where: { userId } });
    if (existing) {
      return existing;
    }
    return this.profiles.save(this.profiles.create({ userId }));
  }

  async updateOwn(userId: string, dto: UpdateProfileDto): Promise<Profile> {
    const profile = await this.getOrCreateOwn(userId);

    if (dto.username !== undefined && dto.username !== profile.username) {
      await this.assertUsernameAvailable(dto.username, profile.id);
    }
    if (dto.cityLocationId !== undefined) {
      await this.assertLocationExists(dto.cityLocationId);
    }

    Object.assign(profile, {
      displayName: dto.displayName ?? profile.displayName,
      username: dto.username ?? profile.username,
      cityLocationId: dto.cityLocationId ?? profile.cityLocationId,
      bio: dto.bio ?? profile.bio,
      avatarMediaId: dto.avatarMediaId ?? profile.avatarMediaId,
    });

    return this.profiles.save(profile);
  }

  /** Публічний перегляд — жодних side-effects (не створює Profile-рядок для анонімно переглянутого користувача). */
  async getPublicProfile(userId: string, requesterUserId?: string): Promise<PublicProfile> {
    const user = await this.users.findOne({ where: { id: userId, deletedAt: IsNull() } });
    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Користувача не знайдено' });
    }

    const profile = await this.profiles.findOne({ where: { userId } });
    return {
      userId,
      displayName: profile?.displayName ?? null,
      username: profile?.username ?? null,
      avatarMediaId: profile?.avatarMediaId ?? null,
      cityLocationId: profile?.cityLocationId ?? null,
      bio: profile?.bio ?? null,
      rating: profile?.rating ?? null,
      reviewsCount: profile?.reviewsCount ?? null,
      activeListingsCount: profile?.activeListingsCount ?? 0,
      memberSince: user.createdAt,
      lastActiveAt: user.lastActiveAt ?? null,
      phone: requesterUserId ? user.phone : null,
    };
  }

  private async assertUsernameAvailable(username: string, excludeProfileId: string): Promise<void> {
    const existing = await this.profiles.findOne({ where: { username } });
    if (existing && existing.id !== excludeProfileId) {
      throw new ConflictException({ code: 'PROFILE_USERNAME_TAKEN', message: 'Це ім’я користувача вже зайняте' });
    }
  }

  private async assertLocationExists(locationId: string): Promise<void> {
    const location = await this.locations.findOne({ where: { id: locationId } });
    if (!location) {
      throw new NotFoundException({ code: 'LOCATION_NOT_FOUND', message: 'Локацію не знайдено' });
    }
  }
}
