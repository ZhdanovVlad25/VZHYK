import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../shared/decorators/current-user.decorator';

/** docs/api.md §9 Chat — REST-частина (WS — ChatGateway, /ws/chat). */
@Controller('chats')
@UseGuards(JwtAuthGuard)
export class ChatsController {
  constructor(private readonly chats: ChatsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateChatDto) {
    return this.chats.findOrCreate(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.chats.listChats(user.id);
  }

  @Get(':id/messages')
  messages(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Query('cursor') cursor?: string) {
    return this.chats.getMessages(user.id, id, cursor);
  }

  @Post(':id/messages')
  send(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.chats.sendMessage(user.id, id, dto.text);
  }

  @Post(':id/block')
  @HttpCode(HttpStatus.NO_CONTENT)
  async block(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.chats.block(user.id, id);
  }
}
