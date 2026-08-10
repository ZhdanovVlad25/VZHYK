import { Message } from './message.entity';

/**
 * ChatsService (REST) і ChatGateway (WS) спілкуються через EventEmitter2, а не пряму
 * DI-залежність одне на одного — уникає циклічного зв'язку Service↔Gateway і дозволяє
 * тестувати ChatsService без піднятого WebSocket-шару.
 */
export const CHAT_MESSAGE_CREATED = 'chat.message.created';

export interface ChatMessageCreatedEvent {
  message: Message;
  recipientUserIds: string[];
}
