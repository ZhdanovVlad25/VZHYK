import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { SettingsModule } from './modules/settings/settings.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { RedisModule } from './providers/redis.module';
import { User } from './modules/users/user.entity';
import { OtpCode } from './modules/auth/otp-code.entity';
import { Profile } from './modules/profiles/profile.entity';
import { Location } from './modules/location/location.entity';
import { Category } from './modules/categories/category.entity';
import { CategoryAttribute } from './modules/attributes/category-attribute.entity';
import { AppSetting } from './modules/settings/app-setting.entity';
import { Listing } from './modules/listings/listing.entity';
import { ListingAttributeValue } from './modules/listings/listing-attribute-value.entity';
import { ListingsModule } from './modules/listings/listings.module';
import { Media } from './modules/media/media.entity';
import { MediaModule } from './modules/media/media.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { UsersModule } from './modules/users/users.module';
import { SearchModule } from './modules/search/search.module';
import { Favorite } from './modules/favorites/favorite.entity';
import { FavoritesModule } from './modules/favorites/favorites.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: join(__dirname, '../../../.env') }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]), // базовий 100/хв на IP, docs/security.md §6
    RedisModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [
          User,
          OtpCode,
          Profile,
          Location,
          Category,
          CategoryAttribute,
          AppSetting,
          Listing,
          ListingAttributeValue,
          Media,
          Favorite,
        ],
        synchronize: false, // структура БД керується виключно міграціями
        migrationsRun: false,
        ssl: config.get<string>('DATABASE_SSL') === 'true',
      }),
    }),
    SettingsModule,
    AuthModule,
    CategoriesModule,
    ListingsModule,
    MediaModule,
    ProfilesModule,
    UsersModule,
    SearchModule,
    FavoritesModule,
  ],
})
export class AppModule {}
