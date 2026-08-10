import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, OptimisticLockVersionMismatchError, Repository } from 'typeorm';
import { Listing } from './listing.entity';
import { ListingAttributeValue } from './listing-attribute-value.entity';
import { Category } from '../categories/category.entity';
import { CategoryAttribute } from '../attributes/category-attribute.entity';
import { SettingsService } from '../settings/settings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { AttributeValueInputDto } from './dto/attribute-value-input.dto';
import { LISTING_TYPES_WITHOUT_REQUIRED_PRICE, ListingStatus } from './listing.constants';

/** Статуси, видимі анонімному відвідувачу (docs/api.md §5 "GET /listings/:id | public"). */
const PUBLICLY_VISIBLE_STATUSES: ListingStatus[] = ['ACTIVE', 'RESERVED', 'SOLD'];

/**
 * Слоти "активного" оголошення для ліміту DEC-05 — статуси, які реально займають
 * місце користувача в переліку "одночасно живих" оголошень. DRAFT/PENDING_MODERATION
 * навмисно не рахуються (це ще не опубліковані оголошення).
 */
const ACTIVE_SLOT_STATUSES: ListingStatus[] = ['ACTIVE', 'RESERVED'];

/**
 * Listings CRUD + State Machine (docs/architecture.md §6, docs/api.md §5).
 * Moderation queue (Phase 4) ще не існує — publish() тимчасово авто-схвалює
 * PENDING_MODERATION → ACTIVE; заміна на реальну перевірку не змінює API.
 */
@Injectable()
export class ListingsService {
  constructor(
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    @InjectRepository(ListingAttributeValue) private readonly attributeValues: Repository<ListingAttributeValue>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(CategoryAttribute) private readonly categoryAttributes: Repository<CategoryAttribute>,
    private readonly settings: SettingsService,
  ) {}

  async create(userId: string, dto: CreateListingDto): Promise<Listing & { attributes: ListingAttributeValue[] }> {
    await this.assertCategoryListable(dto.categoryId);

    const listing = await this.listings.save(
      this.listings.create({
        userId,
        categoryId: dto.categoryId,
        listingType: dto.listingType,
        title: dto.title,
        description: dto.description ?? null,
        price: dto.price ?? null,
        currency: dto.currency ?? 'UAH',
        isNegotiable: dto.isNegotiable ?? false,
        condition: dto.condition ?? null,
        locationId: dto.locationId ?? null,
        status: 'DRAFT',
      }),
    );

    const attributes = dto.attributes
      ? await this.applyAttributeValues(listing.id, dto.categoryId, dto.attributes)
      : [];

    return { ...listing, attributes };
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateListingDto,
  ): Promise<Listing & { attributes: ListingAttributeValue[] }> {
    const listing = await this.findOwnedListing(userId, id);

    if (['SOLD', 'ARCHIVED', 'BLOCKED'].includes(listing.status)) {
      throw new BadRequestException({
        code: 'LISTING_NOT_EDITABLE',
        message: 'Оголошення в цьому статусі більше не можна редагувати',
      });
    }

    Object.assign(listing, {
      listingType: dto.listingType ?? listing.listingType,
      title: dto.title ?? listing.title,
      description: dto.description ?? listing.description,
      price: dto.price ?? listing.price,
      currency: dto.currency ?? listing.currency,
      isNegotiable: dto.isNegotiable ?? listing.isNegotiable,
      condition: dto.condition ?? listing.condition,
      locationId: dto.locationId ?? listing.locationId,
    });

    const saved = await this.saveWithConflictHandling(listing);

    const attributes = dto.attributes
      ? await this.applyAttributeValues(saved.id, saved.categoryId, dto.attributes)
      : await this.attributeValues.find({ where: { listingId: saved.id } });

    return { ...saved, attributes };
  }

  async publish(userId: string, id: string): Promise<Listing> {
    const listing = await this.findOwnedListing(userId, id);

    if (!['DRAFT', 'REJECTED'].includes(listing.status)) {
      throw new BadRequestException({
        code: 'LISTING_INVALID_TRANSITION',
        message: `Публікація недоступна зі статусу ${listing.status}`,
      });
    }

    const priceRequired = !LISTING_TYPES_WITHOUT_REQUIRED_PRICE.includes(listing.listingType);
    if (priceRequired && (listing.price === null || listing.price === undefined)) {
      throw new BadRequestException({
        code: 'LISTING_PRICE_REQUIRED',
        message: 'Для цього типу оголошення потрібно вказати ціну',
      });
    }

    await this.assertRequiredAttributesFilled(listing.id, listing.categoryId);

    const activeCount = await this.listings.count({
      where: { userId, status: In(ACTIVE_SLOT_STATUSES) },
    });
    const maxActive = await this.settings.getMaxActiveListingsPerUser();
    if (activeCount >= maxActive) {
      throw new ForbiddenException({
        code: 'LISTING_ACTIVE_LIMIT_REACHED',
        message: `Досягнуто ліміту активних оголошень (${maxActive}). Продайте або заархівуйте інше оголошення.`,
      });
    }

    // TODO(Phase 4): замінити на реальний ModerationProvider.checkText() + чергу через PENDING_MODERATION.
    listing.status = 'ACTIVE';
    listing.publishedAt = new Date();
    return this.saveWithConflictHandling(listing);
  }

  async archive(userId: string, id: string): Promise<Listing> {
    const listing = await this.findOwnedListing(userId, id);
    this.assertTransition(listing.status, ['ACTIVE', 'RESERVED'], 'ARCHIVED');
    listing.status = 'ARCHIVED';
    return this.saveWithConflictHandling(listing);
  }

  async markSold(userId: string, id: string): Promise<Listing> {
    const listing = await this.findOwnedListing(userId, id);
    this.assertTransition(listing.status, ['ACTIVE', 'RESERVED'], 'SOLD');
    listing.status = 'SOLD';
    return this.saveWithConflictHandling(listing);
  }

  async remove(userId: string, id: string): Promise<void> {
    const listing = await this.findOwnedListing(userId, id);
    listing.deletedAt = new Date();
    await this.saveWithConflictHandling(listing);
  }

  async findVisible(id: string, requesterUserId?: string): Promise<Listing & { attributes: ListingAttributeValue[] }> {
    const listing = await this.listings.findOne({ where: { id, deletedAt: IsNull() } });
    if (!listing) {
      throw new NotFoundException({ code: 'LISTING_NOT_FOUND', message: 'Оголошення не знайдено' });
    }

    const isOwner = Boolean(requesterUserId) && listing.userId === requesterUserId;
    if (!isOwner && !PUBLICLY_VISIBLE_STATUSES.includes(listing.status)) {
      // Не розкриваємо існування чужих чернеток/заблокованих оголошень.
      throw new NotFoundException({ code: 'LISTING_NOT_FOUND', message: 'Оголошення не знайдено' });
    }

    const attributes = await this.attributeValues.find({ where: { listingId: id } });

    if (!isOwner) {
      await this.listings.increment({ id }, 'viewsCount', 1);
      listing.viewsCount += 1;
    }

    return { ...listing, attributes };
  }

  /** Публічний для перевикористання ownership-перевірки в суміжних модулях (напр. MediaService). */
  async findOwnedListing(userId: string, id: string): Promise<Listing> {
    const listing = await this.listings.findOne({ where: { id, deletedAt: IsNull() } });
    if (!listing) {
      throw new NotFoundException({ code: 'LISTING_NOT_FOUND', message: 'Оголошення не знайдено' });
    }
    if (listing.userId !== userId) {
      throw new ForbiddenException({ code: 'LISTING_NOT_OWNER', message: 'Це оголошення належить іншому користувачу' });
    }
    return listing;
  }

  private assertTransition(from: ListingStatus, allowedFrom: ListingStatus[], to: ListingStatus): void {
    if (!allowedFrom.includes(from)) {
      throw new BadRequestException({
        code: 'LISTING_INVALID_TRANSITION',
        message: `Перехід ${from} → ${to} недопустимий`,
      });
    }
  }

  private async assertCategoryListable(categoryId: string): Promise<Category> {
    const category = await this.categories.findOne({ where: { id: categoryId, deletedAt: IsNull(), isActive: true } });
    if (!category) {
      throw new NotFoundException({ code: 'CATEGORY_NOT_FOUND', message: 'Категорію не знайдено' });
    }
    const childrenCount = await this.categories.count({ where: { parentId: categoryId, deletedAt: IsNull() } });
    if (childrenCount > 0) {
      throw new BadRequestException({
        code: 'CATEGORY_NOT_LISTABLE',
        message: 'Оголошення можна створювати лише в кінцевій категорії (без підкатегорій)',
      });
    }
    return category;
  }

  /** Часткове злиття наданих значень атрибутів; ключі, відсутні у вхідному масиві, не чіпаються. */
  private async applyAttributeValues(
    listingId: string,
    categoryId: string,
    inputs: AttributeValueInputDto[],
  ): Promise<ListingAttributeValue[]> {
    const categoryAttrs = await this.categoryAttributes.find({ where: { categoryId } });
    const byId = new Map(categoryAttrs.map((attr) => [attr.id, attr]));

    for (const input of inputs) {
      const attr = byId.get(input.categoryAttributeId);
      if (!attr) {
        throw new BadRequestException({
          code: 'LISTING_ATTRIBUTE_UNKNOWN',
          message: 'Атрибут не належить обраній категорії',
          details: { categoryAttributeId: input.categoryAttributeId },
        });
      }
      this.validateAttributeValue(attr, input.value);
    }

    for (const input of inputs) {
      const existing = await this.attributeValues.findOne({
        where: { listingId, categoryAttributeId: input.categoryAttributeId },
      });
      if (existing) {
        existing.value = input.value;
        await this.attributeValues.save(existing);
      } else {
        await this.attributeValues.save(
          this.attributeValues.create({ listingId, categoryAttributeId: input.categoryAttributeId, value: input.value }),
        );
      }
    }

    return this.attributeValues.find({ where: { listingId } });
  }

  private async assertRequiredAttributesFilled(listingId: string, categoryId: string): Promise<void> {
    const required = await this.categoryAttributes.find({ where: { categoryId, isRequired: true } });
    if (required.length === 0) {
      return;
    }
    const existing = await this.attributeValues.find({ where: { listingId } });
    const filledIds = new Set(existing.map((v) => v.categoryAttributeId));
    const missing = required.filter((attr) => !filledIds.has(attr.id));
    if (missing.length > 0) {
      throw new BadRequestException({
        code: 'LISTING_ATTRIBUTES_INCOMPLETE',
        message: 'Заповніть обов’язкові характеристики перед публікацією',
        details: missing.map((attr) => ({ key: attr.key, labelUk: attr.labelUk })),
      });
    }
  }

  private validateAttributeValue(attr: CategoryAttribute, value: unknown): void {
    const invalid = () =>
      new BadRequestException({
        code: 'LISTING_ATTRIBUTE_INVALID',
        message: `Некоректне значення для атрибута "${attr.labelUk}"`,
        details: { key: attr.key, dataType: attr.dataType },
      });

    switch (attr.dataType) {
      case 'string':
        if (typeof value !== 'string') throw invalid();
        break;
      case 'number':
        if (typeof value !== 'number' || Number.isNaN(value)) throw invalid();
        break;
      case 'boolean':
        if (typeof value !== 'boolean') throw invalid();
        break;
      case 'enum': {
        if (typeof value !== 'string') throw invalid();
        const options = this.extractEnumOptions(attr.enumOptions);
        if (options && !options.includes(value)) throw invalid();
        break;
      }
      case 'multi_enum': {
        if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) throw invalid();
        const options = this.extractEnumOptions(attr.enumOptions);
        if (options && !(value as string[]).every((v) => options.includes(v))) throw invalid();
        break;
      }
      case 'range': {
        const range = value as { min?: unknown; max?: unknown } | null;
        if (typeof range !== 'object' || range === null || typeof range.min !== 'number' || typeof range.max !== 'number') {
          throw invalid();
        }
        break;
      }
    }
  }

  private extractEnumOptions(enumOptions: Record<string, unknown> | null): string[] | null {
    if (!enumOptions || !Array.isArray(enumOptions.values)) {
      return null;
    }
    return (enumOptions.values as unknown[]).filter((v): v is string => typeof v === 'string');
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
