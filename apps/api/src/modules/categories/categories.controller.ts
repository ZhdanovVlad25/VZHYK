import { Controller, Get, Param, Query } from '@nestjs/common';
import { CategoriesService } from './categories.service';

/** docs/api.md §4 Categories & Attributes — публічні read-endpoints. */
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  tree() {
    return this.categories.findTree();
  }

  // Статичний шлях має йти перед ':slug', інакше Express зловить "suggest" як slug.
  @Get('suggest')
  suggest(@Query('title') title?: string) {
    return this.categories.suggest(title ?? '');
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.categories.findBySlug(slug);
  }

  @Get(':id/attributes')
  attributes(@Param('id') id: string) {
    return this.categories.findAttributes(id);
  }
}
