import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chat } from './chat.entity';
import { ChatParticipant } from './chat-participant.entity';
import { Message } from './message.entity';
import { User } from '../users/user.entity';
import { Listing } from '../listings/listing.entity';
import { ChatsService } from './chats.service';
import { ChatsController } from './chats.controller';
import { ChatGateway } from './chat.gateway';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Chat, ChatParticipant, Message, User, Listing]), AuthModule],
  controllers: [ChatsController],
  providers: [ChatsService, ChatGateway],
})
export class ChatModule {}
