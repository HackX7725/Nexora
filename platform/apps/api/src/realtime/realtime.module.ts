import { Module } from '@nestjs/common';
import { ConversationsModule } from '../modules/conversations/conversations.module';
import { MessagesModule } from '../modules/messages/messages.module';
import { MessagingGateway } from './messaging.gateway';
import { OutboxPublisher } from './outbox.publisher';

@Module({
  imports: [MessagesModule, ConversationsModule],
  providers: [MessagingGateway, OutboxPublisher],
})
export class RealtimeModule {}
