import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Profile } from './profile.entity';
import { User } from '../users/user.entity';
import { Location } from '../location/location.entity';
import { ProfilesService } from './profiles.service';
import { ProfilesController } from './profiles.controller';
import { ListingsModule } from '../listings/listings.module';
import { MediaModule } from '../media/media.module';
import { FavoritesModule } from '../favorites/favorites.module';

@Module({
  imports: [TypeOrmModule.forFeature([Profile, User, Location]), ListingsModule, MediaModule, FavoritesModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
