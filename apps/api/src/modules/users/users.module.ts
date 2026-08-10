import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { ProfilesModule } from '../profiles/profiles.module';

@Module({
  imports: [ProfilesModule],
  controllers: [UsersController],
})
export class UsersModule {}
