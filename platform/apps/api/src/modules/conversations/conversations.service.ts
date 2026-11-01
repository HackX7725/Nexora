import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationType, Prisma } from '@prisma/client';
import { directKey } from '../messages/message-policy';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateConversationDto } from './dto';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateConversationDto) {
    if (dto.type === 'DIRECT') {
      if (!dto.participantId) throw new BadRequestException('Choose a person to message.');
      return this.createDirect(userId, dto.participantId);
    }
    const title = dto.title?.trim() || '';
    if (title.length < 2) throw new BadRequestException('Give the group a name.');
    const memberIds = [...new Set(dto.memberIds || [])].filter((id) => id !== userId);
    const people = await this.prisma.user.findMany({ where: { id: { in: memberIds } }, select: { id: true } });
    if (people.length !== memberIds.length) throw new NotFoundException('One of those people does not exist.');
    await this.assertNotBlocked(userId, memberIds);
    const conversation = await this.prisma.conversation.create({
      data: {
        type: 'GROUP',
        title,
        members: {
          create: [
            { userId, role: 'OWNER' },
            ...memberIds.map((id) => ({ userId: id, role: 'MEMBER' as const })),
          ],
        },
      },
      include: { members: { include: { user: { include: { profile: true } } } } },
    });
    return presentConversation(conversation);
  }

  async list(userId: string) {
    const rows = await this.prisma.conversation.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: { include: { user: { include: { profile: true } } } },
        messages: {
          orderBy: { sequenceNumber: 'desc' },
          take: 1,
          include: { senderDevice: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return { conversations: rows.map(presentConversation) };
  }

  async get(userId: string, conversationId: string) {
    const conversation = await this.requireMember(userId, conversationId);
    return presentConversation(conversation);
  }

  async requireMember(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, members: { some: { userId } } },
      include: { members: { include: { user: { include: { profile: true } } } } },
    });
    if (!conversation) throw new NotFoundException('Conversation not found.');
    return conversation;
  }

  private async createDirect(userId: string, participantId: string) {
    const other = await this.prisma.user.findUnique({ where: { id: participantId }, include: { profile: true } });
    if (!other) throw new NotFoundException('That person does not exist.');
    await this.assertNotBlocked(userId, [participantId]);
    const key = directKey(userId, participantId);
    const existing = await this.prisma.conversation.findUnique({
      where: { directKey: key },
      include: { members: { include: { user: { include: { profile: true } } } } },
    });
    if (existing) return presentConversation(existing);
    try {
      const conversation = await this.prisma.conversation.create({
        data: {
          type: ConversationType.DIRECT,
          directKey: key,
          members: {
            create: [
              { userId, role: 'OWNER' },
              { userId: participantId, role: 'MEMBER' },
            ],
          },
        },
        include: { members: { include: { user: { include: { profile: true } } } } },
      });
      return presentConversation(conversation);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const replay = await this.prisma.conversation.findUnique({
          where: { directKey: key },
          include: { members: { include: { user: { include: { profile: true } } } } },
        });
        if (replay) return presentConversation(replay);
      }
      throw error;
    }
  }

  private async assertNotBlocked(userId: string, otherIds: string[]) {
    if (!otherIds.length) return;
    const block = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: { in: otherIds } },
          { blockedId: userId, blockerId: { in: otherIds } },
        ],
      },
    });
    if (block) throw new ForbiddenException('This conversation is not available.');
  }
}

type ConversationWithMembers = {
  id: string;
  type: ConversationType;
  title: string | null;
  updatedAt: Date;
  members: Array<{
    userId: string;
    role: string;
    user: { username: string; profile: { displayName: string } | null };
  }>;
  messages?: Array<{
    ciphertext: string;
    sequenceNumber: number;
    senderDevice: { userId: string };
  }>;
};

function presentConversation(conversation: ConversationWithMembers) {
  const latest = conversation.messages?.[0];
  return {
    id: conversation.id,
    type: conversation.type,
    title: conversation.title,
    updatedAt: conversation.updatedAt.toISOString(),
    preview: latest?.ciphertext || '',
    previewSequence: latest?.sequenceNumber || 0,
    previewSenderId: latest?.senderDevice.userId || null,
    members: conversation.members.map((member) => ({
      userId: member.userId,
      role: member.role,
      username: member.user.username,
      displayName: member.user.profile?.displayName || member.user.username,
    })),
  };
}
