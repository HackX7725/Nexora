import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EncryptionHeader, StoredMessage } from '@platform/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';
import { SendMessageDto } from './dto';
import { isReplay } from './message-policy';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversations: ConversationsService,
  ) {}

  async send(userId: string, conversationId: string, dto: SendMessageDto, idempotencyKey?: string) {
    if (idempotencyKey && idempotencyKey !== dto.clientMessageId) {
      throw new BadRequestException('Idempotency-Key must match clientMessageId.');
    }
    if (!dto.ciphertext.trim()) throw new BadRequestException('Message content is required.');
    await this.conversations.requireMember(userId, conversationId);
    const device = await this.prisma.device.findFirst({ where: { id: dto.senderDeviceId, userId } });
    if (!device) throw new NotFoundException('This device is not registered.');
    const existing = await this.prisma.message.findUnique({
      where: { senderDeviceId_clientMessageId: { senderDeviceId: dto.senderDeviceId, clientMessageId: dto.clientMessageId } },
      include: { senderDevice: true },
    });
    if (isReplay(existing?.id || null)) {
      if (existing && existing.conversationId !== conversationId) {
        throw new BadRequestException('That message id was already used.');
      }
      return this.toStored(existing!);
    }
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const conversation = await tx.conversation.update({
          where: { id: conversationId },
          data: { lastSequence: { increment: 1 } },
          select: { lastSequence: true },
        });
        const message = await tx.message.create({
          data: {
            conversationId,
            senderDeviceId: dto.senderDeviceId,
            clientMessageId: dto.clientMessageId,
            ciphertext: dto.ciphertext,
            encryptionHeader: {
              algorithm: dto.encryptionHeader.algorithm,
              keyVersion: dto.encryptionHeader.keyVersion,
            },
            sequenceNumber: conversation.lastSequence,
            replyToMessageId: dto.replyToMessageId,
          },
          include: { senderDevice: true },
        });
        await tx.outboxEvent.create({
          data: {
            type: 'message:new',
            payload: { messageId: message.id, conversationId },
            publishedAt: null,
          },
        });
        return message;
      });
      return this.toStored(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const replay = await this.prisma.message.findUnique({
          where: { senderDeviceId_clientMessageId: { senderDeviceId: dto.senderDeviceId, clientMessageId: dto.clientMessageId } },
          include: { senderDevice: true },
        });
        if (replay) return this.toStored(replay);
      }
      throw error;
    }
  }

  async history(userId: string, conversationId: string, after: number, limit: number) {
    await this.conversations.requireMember(userId, conversationId);
    const messages = await this.prisma.message.findMany({
      where: { conversationId, sequenceNumber: { gt: after } },
      include: { senderDevice: true },
      orderBy: { sequenceNumber: 'asc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
    return { messages: messages.map((message) => this.toStored(message)) };
  }

  async receipt(userId: string, deviceId: string, messageId: string, status: 'DELIVERED' | 'READ') {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message not found.');
    await this.conversations.requireMember(userId, message.conversationId);
    const device = await this.prisma.device.findFirst({ where: { id: deviceId, userId } });
    if (!device) throw new NotFoundException('This device is not registered.');
    await this.prisma.messageReceipt.upsert({
      where: { messageId_deviceId: { messageId, deviceId } },
      update: { status },
      create: { messageId, deviceId, status },
    });
    return { messageId, deviceId, status: status.toLowerCase() };
  }

  private toStored(message: {
    id: string;
    clientMessageId: string;
    conversationId: string;
    sequenceNumber: number;
    createdAt: Date;
    senderDeviceId: string;
    ciphertext: string;
    encryptionHeader: Prisma.JsonValue;
    replyToMessageId: string | null;
    senderDevice: { userId: string };
  }): StoredMessage {
    return {
      id: message.id,
      clientMessageId: message.clientMessageId,
      conversationId: message.conversationId,
      sequenceNumber: message.sequenceNumber,
      status: 'accepted',
      createdAt: message.createdAt.toISOString(),
      senderDeviceId: message.senderDeviceId,
      senderUserId: message.senderDevice.userId,
      ciphertext: message.ciphertext,
      encryptionHeader: message.encryptionHeader as unknown as EncryptionHeader,
      replyToMessageId: message.replyToMessageId,
    };
  }
}
