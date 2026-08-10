import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Media } from './media.entity';
import { UpdateMediaDto } from './dto/update-media.dto';
import { ListingsService } from '../listings/listings.service';
import { STORAGE_PROVIDER, StorageProvider } from '../../providers/storage/storage-provider.interface';
import { ALLOWED_IMAGE_MIME_TYPES, extensionForMimeType, matchesImageSignature } from './image-signature';

/** docs/security.md §5 — ліміт 10MB/фото застосовується також на рівні MulterModule (interceptor). */
export const MAX_MEDIA_SIZE_BYTES = 10 * 1024 * 1024;

/** docs/api.md §6 Media. Media upload pipeline: validation (whitelist + magic bytes) → StorageProvider. */
@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(Media) private readonly media: Repository<Media>,
    private readonly listings: ListingsService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async upload(
    userId: string,
    listingId: string,
    file: Express.Multer.File | undefined,
  ): Promise<Media & { url: string }> {
    await this.listings.findOwnedListing(userId, listingId);
    this.assertValidImage(file);
    const validFile = file as Express.Multer.File;

    const key = `listings/${listingId}/${randomUUID()}.${extensionForMimeType(validFile.mimetype)}`;
    const stored = await this.storage.upload(validFile.buffer, {
      key,
      mimeType: validFile.mimetype,
      sizeBytes: validFile.size,
    });

    const existingCount = await this.media.count({ where: { listingId } });

    const saved = await this.media.save(
      this.media.create({
        listingId,
        ownerUserId: userId,
        storageKey: key,
        mimeType: validFile.mimetype,
        sizeBytes: validFile.size,
        isMain: existingCount === 0,
        sortOrder: existingCount,
      }),
    );

    return { ...saved, url: stored.url };
  }

  async update(userId: string, listingId: string, mediaId: string, dto: UpdateMediaDto): Promise<Media & { url: string }> {
    await this.listings.findOwnedListing(userId, listingId);
    const item = await this.getOwnedMediaOrThrow(listingId, mediaId);

    if (dto.isMain === true && !item.isMain) {
      await this.media.update({ listingId }, { isMain: false });
      item.isMain = true;
    } else if (dto.isMain === false) {
      item.isMain = false;
    }

    if (dto.sortOrder !== undefined) {
      item.sortOrder = dto.sortOrder;
    }

    const saved = await this.media.save(item);
    return { ...saved, url: await this.storage.getSignedUrl(saved.storageKey) };
  }

  async remove(userId: string, listingId: string, mediaId: string): Promise<void> {
    await this.listings.findOwnedListing(userId, listingId);
    const item = await this.getOwnedMediaOrThrow(listingId, mediaId);

    await this.storage.delete(item.storageKey);
    await this.media.remove(item);
  }

  private async getOwnedMediaOrThrow(listingId: string, mediaId: string): Promise<Media> {
    const item = await this.media.findOne({ where: { id: mediaId, listingId } });
    if (!item) {
      throw new NotFoundException({ code: 'MEDIA_NOT_FOUND', message: 'Файл не знайдено' });
    }
    return item;
  }

  private assertValidImage(file?: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException({ code: 'LISTING_MEDIA_FILE_REQUIRED', message: 'Файл не передано' });
    }
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException({
        code: 'LISTING_MEDIA_INVALID_TYPE',
        message: `Непідтримуваний тип файлу. Дозволено: ${ALLOWED_IMAGE_MIME_TYPES.join(', ')}`,
      });
    }
    if (!matchesImageSignature(file.mimetype, file.buffer)) {
      throw new BadRequestException({
        code: 'LISTING_MEDIA_INVALID_TYPE',
        message: 'Вміст файлу не відповідає заявленому типу',
      });
    }
  }
}
