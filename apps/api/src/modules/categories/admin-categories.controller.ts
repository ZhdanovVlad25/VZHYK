import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { AttributesService } from '../attributes/attributes.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateAttributeDto } from '../attributes/dto/create-attribute.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';

/** docs/api.md §4 Categories & Attributes — admin write-endpoints. */
@Controller('admin/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminCategoriesController {
  constructor(
    private readonly categories: CategoriesService,
    private readonly attributes: AttributesService,
  ) {}

  /** Включає неактивні категорії, на відміну від публічного GET /categories — потрібне для Admin Panel. */
  @Get()
  findAll() {
    return this.categories.findAdminTree();
  }

  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.categories.remove(id);
  }

  @Post(':id/attributes')
  createAttribute(@Param('id') id: string, @Body() dto: CreateAttributeDto) {
    return this.attributes.create(id, dto);
  }
}
