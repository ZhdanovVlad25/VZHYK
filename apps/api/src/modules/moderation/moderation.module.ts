import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModerationCase } from './moderation-case.entity';
import { Listing } from '../listings/listing.entity';
import { Media } from '../media/media.entity';
import { User } from '../users/user.entity';
import { ModerationService } from './moderation.service';
import { ModerationController } from './moderation.controller';
import { ModerationEmailService } from './moderation-email.service';
import { ModerationEmailController } from './moderation-email.controller';
import { SearchProviderModule } from '../../providers/search/search.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RiskModule } from '../risk/risk.module';
import { SettingsModule } from '../settings/settings.module';
import { StorageModule } from '../../providers/storage/storage.module';
import { EmailModule } from '../../providers/email/email.module';

/**
 * StorageModule/EmailModule підключені напряму (не через MediaModule) — MediaModule
 * імпортує ListingsModule, а ListingsModule вже імпортує ModerationModule, тож похід через
 * MediaModule замкнув би цикл ModerationModule → MediaModule → ListingsModule → ModerationModule.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ModerationCase, Listing, Media, User]),
    SearchProviderModule,
    AuditLogModule,
    RiskModule,
    SettingsModule,
    StorageModule,
    EmailModule,
  ],
  controllers: [ModerationController, ModerationEmailController],
  providers: [ModerationService, ModerationEmailService],
  exports: [ModerationService],
})
export class ModerationModule {}
