import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import Redis from 'ioredis';
import { Category } from './category.entity';
import { CategoryAttribute } from '../attributes/category-attribute.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { REDIS_CLIENT } from '../../providers/redis.provider';

const TREE_CACHE_KEY = 'categories:tree';
const TREE_CACHE_TTL_SECONDS = 60;

/** 0 = root (Category), 1 = Subcategory, 2 = Sub-subcategory — docs/categories.md §1 */
const MAX_LEVEL = 2;

export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
}

/**
 * Categories & Attributes CRUD (docs/api.md §4, docs/categories.md).
 * Видалення категорії з активними оголошеннями заблоковано (decisions.md DEC-03) —
 * поки Listings module не існує (Phase 2), тут блокується видалення з дочірніми
 * категоріями; перевірка активних оголошень додається разом з Listings.
 */
@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(CategoryAttribute) private readonly attributes: Repository<CategoryAttribute>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async findTree(): Promise<CategoryTreeNode[]> {
    const cached = await this.redis.get(TREE_CACHE_KEY);
    if (cached !== null) {
      return JSON.parse(cached) as CategoryTreeNode[];
    }

    const all = await this.categories.find({
      where: { deletedAt: IsNull(), isActive: true },
      order: { sortOrder: 'ASC' },
    });

    const byId = new Map<string, CategoryTreeNode>(all.map((c) => [c.id, { ...c, children: [] }]));
    const roots: CategoryTreeNode[] = [];
    for (const node of byId.values()) {
      if (node.parentId && byId.has(node.parentId)) {
        byId.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    await this.redis.set(TREE_CACHE_KEY, JSON.stringify(roots), 'EX', TREE_CACHE_TTL_SECONDS);
    return roots;
  }

  async findBySlug(slug: string) {
    const category = await this.categories.findOne({ where: { slug, deletedAt: IsNull() } });
    if (!category) {
      throw new NotFoundException({ code: 'CATEGORY_NOT_FOUND', message: 'Категорію не знайдено' });
    }

    const [children, attributes] = await Promise.all([
      this.categories.find({
        where: { parentId: category.id, deletedAt: IsNull(), isActive: true },
        order: { sortOrder: 'ASC' },
      }),
      this.attributes.find({ where: { categoryId: category.id }, order: { sortOrder: 'ASC' } }),
    ]);

    return { ...category, children, attributes };
  }

  async findAttributes(categoryId: string): Promise<CategoryAttribute[]> {
    await this.getActiveOrThrow(categoryId);
    return this.attributes.find({ where: { categoryId }, order: { sortOrder: 'ASC' } });
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    const parentId = dto.parentId ?? null;
    const level = await this.resolveLevel(parentId);
    await this.assertSlugAvailable(parentId, dto.slug);

    const category = await this.categories.save(
      this.categories.create({
        nameUk: dto.nameUk,
        slug: dto.slug,
        parentId,
        icon: dto.icon ?? null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        level,
      }),
    );

    await this.invalidateTreeCache();
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.getActiveOrThrow(id);

    let nextParentId = category.parentId;
    let nextLevel = category.level;

    if (dto.parentId !== undefined) {
      const newParentId = dto.parentId;
      if (newParentId === category.id) {
        throw new BadRequestException({
          code: 'CATEGORY_INVALID_PARENT',
          message: 'Категорія не може бути власним батьком',
        });
      }
      if (newParentId !== null) {
        await this.assertNoCycle(category.id, newParentId);
      }
      nextLevel = await this.resolveLevel(newParentId);
      nextParentId = newParentId;
    }

    const nextSlug = dto.slug ?? category.slug;
    if (dto.slug !== undefined || nextParentId !== category.parentId) {
      await this.assertSlugAvailable(nextParentId, nextSlug, category.id);
    }

    if (nextLevel !== category.level) {
      await this.cascadeLevelShift(category.id, nextLevel - category.level);
    }

    Object.assign(category, {
      nameUk: dto.nameUk ?? category.nameUk,
      slug: nextSlug,
      parentId: nextParentId,
      level: nextLevel,
      icon: dto.icon ?? category.icon,
      sortOrder: dto.sortOrder ?? category.sortOrder,
      isActive: dto.isActive ?? category.isActive,
    });

    const saved = await this.categories.save(category);
    await this.invalidateTreeCache();
    return saved;
  }

  async remove(id: string): Promise<void> {
    const category = await this.getActiveOrThrow(id);

    const childrenCount = await this.categories.count({ where: { parentId: id, deletedAt: IsNull() } });
    if (childrenCount > 0) {
      throw new ConflictException({
        code: 'CATEGORY_HAS_CHILDREN',
        message: 'Неможливо видалити категорію з активними підкатегоріями',
      });
    }

    category.deletedAt = new Date();
    category.isActive = false;
    await this.categories.save(category);
    await this.invalidateTreeCache();
  }

  private async getActiveOrThrow(id: string): Promise<Category> {
    const category = await this.categories.findOne({ where: { id, deletedAt: IsNull() } });
    if (!category) {
      throw new NotFoundException({ code: 'CATEGORY_NOT_FOUND', message: 'Категорію не знайдено' });
    }
    return category;
  }

  private async resolveLevel(parentId: string | null): Promise<number> {
    if (parentId === null) {
      return 0;
    }
    const parent = await this.getActiveOrThrow(parentId);
    const level = parent.level + 1;
    if (level > MAX_LEVEL) {
      throw new BadRequestException({
        code: 'CATEGORY_MAX_DEPTH_EXCEEDED',
        message: `Максимальна глибина дерева категорій — ${MAX_LEVEL + 1} рівні`,
      });
    }
    return level;
  }

  private async assertSlugAvailable(parentId: string | null, slug: string, excludeId?: string): Promise<void> {
    const existing = await this.categories.findOne({
      where: { parentId: parentId ?? IsNull(), slug, deletedAt: IsNull() },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException({
        code: 'CATEGORY_SLUG_TAKEN',
        message: 'Категорія з таким slug вже існує на цьому рівні',
      });
    }
  }

  /** Забороняє переміщення категорії всередину її ж піддерева (цикл у дереві). */
  private async assertNoCycle(categoryId: string, newParentId: string): Promise<void> {
    let current: Category | null = await this.getActiveOrThrow(newParentId);
    while (current) {
      if (current.id === categoryId) {
        throw new BadRequestException({
          code: 'CATEGORY_CYCLE',
          message: 'Неможливо перемістити категорію в її власну підкатегорію',
        });
      }
      current = current.parentId ? await this.categories.findOne({ where: { id: current.parentId } }) : null;
    }
  }

  /** Рекурсивно зсуває level усіх нащадків при переміщенні категорії в дереві. */
  private async cascadeLevelShift(categoryId: string, delta: number): Promise<void> {
    const children = await this.categories.find({ where: { parentId: categoryId, deletedAt: IsNull() } });
    for (const child of children) {
      child.level += delta;
      await this.categories.save(child);
      await this.cascadeLevelShift(child.id, delta);
    }
  }

  private async invalidateTreeCache(): Promise<void> {
    await this.redis.del(TREE_CACHE_KEY);
  }
}
