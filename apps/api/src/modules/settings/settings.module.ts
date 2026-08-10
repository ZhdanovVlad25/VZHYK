import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSetting } from './app-setting.entity';
import { SettingsService } from './settings.service';
import { RedisModule } from '../../providers/redis.module';

@Module({
  imports: [TypeOrmModule.forFeature([AppSetting]), RedisModule],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
