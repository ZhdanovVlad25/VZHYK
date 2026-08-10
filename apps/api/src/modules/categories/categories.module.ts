import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './category.entity';
import { CategoryAttribute } from '../attributes/category-attribute.entity';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { AdminCategoriesController } from './admin-categories.controller';
import { AttributesModule } from '../attributes/attributes.module';

@Module({
  imports: [TypeOrmModule.forFeature([Category, CategoryAttribute]), AttributesModule],
  controllers: [CategoriesController, AdminCategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
