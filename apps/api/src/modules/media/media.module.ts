import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Media } from './media.entity';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { ListingsModule } from '../listings/listings.module';
import { StorageModule } from '../../providers/storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([Media]), ListingsModule, StorageModule],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
