import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CategoryAttribute } from './category-attribute.entity';
import { Category } from '../categories/category.entity';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';

/** Category Attributes CRUD (docs/api.md §4, docs/categories.md §2). */
@Injectable()
export class AttributesService {
  constructor(
    @InjectRepository(CategoryAttribute) private readonly attributes: Repository<CategoryAttribute>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
  ) {}

  async create(categoryId: string, dto: CreateAttributeDto): Promise<CategoryAttribute> {
    const category = await this.categories.findOne({ where: { id: categoryId, deletedAt: IsNull() } });
    if (!category) {
      throw new NotFoundException({ code: 'CATEGORY_NOT_FOUND', message: 'Категорію не знайдено' });
    }

    await this.assertKeyAvailable(categoryId, dto.key);

    return this.attributes.save(
      this.attributes.create({
        categoryId,
        key: dto.key,
        labelUk: dto.labelUk,
        dataType: dto.dataType,
        enumOptions: dto.enumOptions ?? null,
        isRequired: dto.isRequired ?? false,
        isFilterable: dto.isFilterable ?? false,
        sortOrder: dto.sortOrder ?? 0,
      }),
    );
  }

  async update(id: string, dto: UpdateAttributeDto): Promise<CategoryAttribute> {
    const attribute = await this.attributes.findOne({ where: { id } });
    if (!attribute) {
      throw new NotFoundException({ code: 'ATTRIBUTE_NOT_FOUND', message: 'Атрибут не знайдено' });
    }

    Object.assign(attribute, {
      labelUk: dto.labelUk ?? attribute.labelUk,
      dataType: dto.dataType ?? attribute.dataType,
      enumOptions: dto.enumOptions ?? attribute.enumOptions,
      isRequired: dto.isRequired ?? attribute.isRequired,
      isFilterable: dto.isFilterable ?? attribute.isFilterable,
      sortOrder: dto.sortOrder ?? attribute.sortOrder,
    });

    return this.attributes.save(attribute);
  }

  private async assertKeyAvailable(categoryId: string, key: string): Promise<void> {
    const existing = await this.attributes.findOne({ where: { categoryId, key } });
    if (existing) {
      throw new ConflictException({
        code: 'ATTRIBUTE_KEY_TAKEN',
        message: 'Атрибут з таким key вже існує в цій категорії',
      });
    }
  }
}
