import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryAttribute } from './category-attribute.entity';
import { Category } from '../categories/category.entity';
import { AttributesService } from './attributes.service';
import { AdminAttributesController } from './admin-attributes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CategoryAttribute, Category])],
  controllers: [AdminAttributesController],
  providers: [AttributesService],
  exports: [AttributesService],
})
export class AttributesModule {}
