import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { User } from './user.entity';
import { ProfilesModule } from '../profiles/profiles.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), ProfilesModule, AuditLogModule],
  controllers: [UsersController, AdminUsersController],
  providers: [AdminUsersService],
})
export class UsersModule {}
