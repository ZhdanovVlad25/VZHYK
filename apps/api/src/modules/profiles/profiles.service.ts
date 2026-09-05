import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Profile } from './profile.entity';
import { User } from '../users/user.entity';
import { Location } from '../location/location.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { MediaService } from '../media/media.service';
import { ListingsService } from '../listings/listings.service';

export interface PublicProfile {
  userId: string;
  displayName: string | null;
  username: string | null;
  avatarMediaId: string | null;
  avatarUrl: string | null;
  cityLocationId: string | null;
  bio: string | null;
  rating: number | null;
  reviewsCount: number | null;
  activeListingsCount: number;
  memberSince: Date;
  lastActiveAt: Date | null;
  /**
   * null або якщо запит анонімний (users.controller.ts OptionalJwtAuthGuard — не віддаємо
   * анонімно, щоб номер не збирали скрейпери), або якщо власник вимкнув acceptsCalls —
   * тоді номер прихований навіть від автентифікованих покупців, лишається лише чат.
   */
  phone: string | null;
  acceptsCalls: boolean;
  /**
   * Безпечний публічний сигнал довіри (аудит 27.08 "шар довіри" — картка оголошення не мала
   * жодного сигналу надійності продавця): сам номер прихований від анонімів/acceptsCalls=false,
   * але БУЛЬ факт "телефон підтверджено" — ні. Кожен номер на платформі верифікований через OTP
   * (auth.service.ts verifyOtp/linkPhone), тож просто "phone існує" вже означає "підтверджено".
   */
  phoneVerified: boolean;
}

export interface MyProfileView extends Profile {
  avatarUrl: string | null;
}

/** docs/api.md §3 Users & Profiles. */
@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Location) private readonly locations: Repository<Location>,
    private readonly media: MediaService,
    private readonly listings: ListingsService,
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
      acceptsCalls: dto.acceptsCalls ?? profile.acceptsCalls,
    });

    return this.profiles.save(profile);
  }

  /** Контролер завжди хоче й підписаний URL, не лише сирий avatarMediaId. */
  async getOwnView(userId: string): Promise<MyProfileView> {
    const profile = await this.getOrCreateOwn(userId);
    const avatarUrl = await this.media.getUrlById(profile.avatarMediaId);
    return { ...profile, avatarUrl };
  }

  async updateOwnView(userId: string, dto: UpdateProfileDto): Promise<MyProfileView> {
    const profile = await this.updateOwn(userId, dto);
    const avatarUrl = await this.media.getUrlById(profile.avatarMediaId);
    return { ...profile, avatarUrl };
  }

  /**
   * Завантаження/заміна фото профілю — media.entity.ts дозволяє listingId: null саме для
   * такого standalone-медіа (раніше не було жодного UI, лише поле avatarMediaId без флоу).
   * Стару аватарку видаляємо зі storage, щоб не накопичувати сирітські об'єкти.
   */
  async updateAvatar(userId: string, file: Express.Multer.File | undefined): Promise<MyProfileView> {
    const profile = await this.getOrCreateOwn(userId);
    const uploaded = await this.media.uploadStandalone(userId, 'avatars', file);

    if (profile.avatarMediaId) {
      await this.media.removeOwned(userId, profile.avatarMediaId).catch(() => undefined);
    }

    profile.avatarMediaId = uploaded.id;
    const saved = await this.profiles.save(profile);
    return { ...saved, avatarUrl: uploaded.url };
  }

  /** Прибрати фото профілю без заміни — до цього єдиним шляхом "позбутись" аватарки була заміна на іншу. */
  async removeAvatar(userId: string): Promise<MyProfileView> {
    const profile = await this.getOrCreateOwn(userId);

    if (profile.avatarMediaId) {
      await this.media.removeOwned(userId, profile.avatarMediaId).catch(() => undefined);
      profile.avatarMediaId = null;
      await this.profiles.save(profile);
    }

    return { ...profile, avatarUrl: null };
  }

  async getMemberSince(userId: string): Promise<Date> {
    const user = await this.users.findOne({ where: { id: userId, deletedAt: IsNull() } });
    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Користувача не знайдено' });
    }
    return user.createdAt;
  }

  /**
   * Публічний перегляд — жодних side-effects (не створює Profile-рядок для анонімно
   * переглянутого користувача). MUST-аудит: "Показати телефон" вимагав повного логіну
   * (реєстрація за номером + SMS) лише щоб побачити ЧУЖИЙ номер — на OLX телефон видно
   * без входу. Телефон більше не гейтиться авторизацією викликача, лише власним вибором
   * продавця (acceptsCalls); маршрут захищений per-IP throttle (users.controller.ts).
   */
  async getPublicProfile(userId: string): Promise<PublicProfile> {
    const user = await this.users.findOne({ where: { id: userId, deletedAt: IsNull() } });
    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Користувача не знайдено' });
    }

    const profile = await this.profiles.findOne({ where: { userId } });
    const acceptsCalls = profile?.acceptsCalls ?? true;
    // Profile.activeListingsCount ніколи не синхронізується (жоден код у кодовій базі
    // його не оновлює) — рахуємо наживо тим самим агрегатом, що й "власний" профіль.
    const stats = await this.listings.getOwnStats(userId);
    return {
      userId,
      displayName: profile?.displayName ?? null,
      username: profile?.username ?? null,
      avatarMediaId: profile?.avatarMediaId ?? null,
      avatarUrl: await this.media.getUrlById(profile?.avatarMediaId ?? null),
      cityLocationId: profile?.cityLocationId ?? null,
      bio: profile?.bio ?? null,
      rating: profile?.rating ?? null,
      reviewsCount: profile?.reviewsCount ?? null,
      activeListingsCount: stats.activeListingsCount,
      memberSince: user.createdAt,
      lastActiveAt: user.lastActiveAt ?? null,
      phone: acceptsCalls ? user.phone : null,
      acceptsCalls,
      phoneVerified: Boolean(user.phone),
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
