import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ChatParticipant } from './chat-participant.entity';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CHAT_MESSAGE_CREATED, ChatMessageCreatedEvent } from './chat.events';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

/**
 * docs/api.md §9 "WS /ws/chat" — typing, online status, realtime push нових повідомлень.
 * Саме надсилання повідомлення йде через REST (ChatsController.send) — сюди прилітає
 * лише подія CHAT_MESSAGE_CREATED для broadcast; WS не має власного шляху запису в БД.
 */
@WebSocketGateway({ namespace: '/ws/chat', cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  private server: Server;

  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(ChatParticipant) private readonly participants: Repository<ChatParticipant>,
  ) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      const token = this.extractToken(client);
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      client.userId = payload.sub;
      await client.join(`user:${payload.sub}`);
      await this.broadcastPresence(payload.sub, 'online');
    } catch (err) {
      this.logger.debug(`WS auth failed: ${(err as Error).message}`);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthenticatedSocket): Promise<void> {
    if (client.userId) {
      await this.broadcastPresence(client.userId, 'offline');
    }
  }

  /** Клієнт приєднується до кімнати конкретного чату, щоб отримувати typing інших учасників. */
  @SubscribeMessage('chat:join')
  async onJoinChat(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: { chatId?: string }) {
    if (!client.userId || !data?.chatId) {
      return;
    }
    const participant = await this.participants.findOne({ where: { chatId: data.chatId, userId: client.userId } });
    if (participant) {
      await client.join(`chat:${data.chatId}`);
    }
  }

  @SubscribeMessage('chat:leave')
  async onLeaveChat(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: { chatId?: string }) {
    if (data?.chatId) {
      await client.leave(`chat:${data.chatId}`);
    }
  }

  @SubscribeMessage('chat:typing')
  onTyping(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: { chatId?: string }): void {
    if (!client.userId || !data?.chatId) {
      return;
    }
    client.to(`chat:${data.chatId}`).emit('chat:typing', { chatId: data.chatId, userId: client.userId });
  }

  @OnEvent(CHAT_MESSAGE_CREATED)
  handleMessageCreated(event: ChatMessageCreatedEvent): void {
    for (const userId of event.recipientUserIds) {
      this.server.to(`user:${userId}`).emit('message:new', event.message);
    }
  }

  private extractToken(client: Socket): string {
    const fromAuth = client.handshake.auth?.token as string | undefined;
    const fromHeader = client.handshake.headers.authorization;
    const raw = fromAuth ?? fromHeader;
    if (!raw) {
      throw new Error('no token provided');
    }
    return raw.startsWith('Bearer ') ? raw.slice(7) : raw;
  }

  private async broadcastPresence(userId: string, status: 'online' | 'offline'): Promise<void> {
    const myParticipations = await this.participants.find({ where: { userId } });
    if (myParticipations.length === 0) {
      return;
    }
    const chatIds = myParticipations.map((p) => p.chatId);
    const others = await this.participants.find({ where: { chatId: In(chatIds) } });
    const partnerIds = new Set(others.filter((p) => p.userId !== userId).map((p) => p.userId));
    for (const partnerId of partnerIds) {
      this.server.to(`user:${partnerId}`).emit('presence', { userId, status });
    }
  }
}
