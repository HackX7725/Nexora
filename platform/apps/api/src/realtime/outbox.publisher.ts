import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingGateway } from './messaging.gateway';

@Injectable()
export class OutboxPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisher.name);
  private timer?: NodeJS.Timeout;
  private publishing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MessagingGateway,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      if (this.publishing) return;
      this.publishing = true;
      this.publish()
        .catch((error: Error) => this.logger.warn(error.message))
        .finally(() => {
          this.publishing = false;
        });
    }, 1000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async publish() {
    const events = await this.prisma.outboxEvent.findMany({
      where: { OR: [{ publishedAt: { isSet: false } }, { publishedAt: null }] },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    for (const event of events) {
      const payload = event.payload as { messageId?: string; conversationId?: string };
      if (event.type === 'message:new' && payload.messageId && payload.conversationId) {
        const message = await this.prisma.message.findUnique({
          where: { id: payload.messageId },
          include: { senderDevice: { include: { user: { include: { profile: true } } } } },
        });
        if (message && !this.gateway.server) return;
        if (message && this.gateway.server) {
          const members = await this.prisma.conversationMember.findMany({
            where: { conversationId: payload.conversationId },
            select: { userId: true },
          });
          const sender = message.senderDevice.user;
          this.gateway.emitNew(payload.conversationId, {
            id: message.id,
            conversationId: message.conversationId,
            senderDeviceId: message.senderDeviceId,
            senderUserId: sender.id,
            senderName: sender.profile?.displayName || sender.username,
            sequenceNumber: message.sequenceNumber,
            ciphertext: message.ciphertext,
            encryptionHeader: message.encryptionHeader,
            replyToMessageId: message.replyToMessageId,
            createdAt: message.createdAt.toISOString(),
          }, members.map((member) => member.userId));
        }
      }
      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: { publishedAt: new Date() },
      });
    }
  }
}
