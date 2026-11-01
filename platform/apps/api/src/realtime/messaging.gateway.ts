import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AccessTokenPayload } from '../common/current-auth';
import { authenticateAccessToken } from '../modules/auth/jwt-auth.guard';
import { ConversationsService } from '../modules/conversations/conversations.service';
import { MessagesService } from '../modules/messages/messages.service';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from '../modules/messages/dto';

interface AuthedSocket extends Socket {
  authUser?: AccessTokenPayload;
  conversationIds?: string[];
}

@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class MessagingGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(MessagingGateway.name);
  private readonly socketsByUser = new Map<string, number>();

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly messages: MessagesService,
    private readonly conversations: ConversationsService,
  ) {}

  afterInit(server: Server) {
    server.use(async (client: AuthedSocket, next) => {
      try {
        const token = client.handshake.auth?.token || headerToken(client.handshake.headers.authorization);
        client.authUser = await authenticateAccessToken(
          token ? `Bearer ${token}` : undefined,
          this.jwt,
          this.prisma,
        );
        next();
      } catch {
        next(new Error('Sign in required.'));
      }
    });
  }

  async handleConnection(client: AuthedSocket) {
    const authUser = client.authUser;
    if (!authUser) {
      client.disconnect(true);
      return;
    }
    try {
      const count = this.socketsByUser.get(authUser.sub) || 0;
      this.socketsByUser.set(authUser.sub, count + 1);
      await client.join(`user:${authUser.sub}`);
      const memberships = await this.prisma.conversationMember.findMany({
        where: { userId: authUser.sub },
        select: { conversationId: true },
      });
      client.conversationIds = memberships.map((member) => member.conversationId);
      await Promise.all(client.conversationIds.map((conversationId) => client.join(`conversation:${conversationId}`)));
      this.emitPresence(client.conversationIds, authUser.sub, 'online');
      client.emit('ready');
    } catch (error) {
      this.logger.warn('Socket setup failed.');
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthedSocket) {
    const userId = client.authUser?.sub;
    if (!userId) return;
    const next = (this.socketsByUser.get(userId) || 1) - 1;
    if (next <= 0) {
      this.socketsByUser.delete(userId);
      this.emitPresence(client.conversationIds || [], userId, 'offline');
      return;
    }
    this.socketsByUser.set(userId, next);
  }

  @SubscribeMessage('message:send')
  async send(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: SendMessageDto & { conversationId?: string }) {
    const authUser = this.requireSocketUser(client);
    const conversationId = body.conversationId || '';
    const message = await this.messages.send(authUser.sub, conversationId, body);
    client.emit('message:accepted', {
      id: message.id,
      clientMessageId: message.clientMessageId,
      conversationId: message.conversationId,
      sequenceNumber: message.sequenceNumber,
      status: message.status,
      createdAt: message.createdAt,
    });
    return message;
  }

  @SubscribeMessage('message:delivered')
  delivered(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { messageId: string }) {
    const authUser = this.requireSocketUser(client);
    return this.messages.receipt(authUser.sub, authUser.did, body.messageId, 'DELIVERED');
  }

  @SubscribeMessage('message:read')
  read(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { messageId: string }) {
    const authUser = this.requireSocketUser(client);
    return this.messages.receipt(authUser.sub, authUser.did, body.messageId, 'READ');
  }

  @SubscribeMessage('typing:start')
  async typingStart(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { conversationId: string }) {
    const authUser = this.requireSocketUser(client);
    await this.conversations.requireMember(authUser.sub, body.conversationId);
    client.to(`conversation:${body.conversationId}`).emit('typing:start', {
      conversationId: body.conversationId,
      userId: authUser.sub,
    });
  }

  @SubscribeMessage('typing:stop')
  async typingStop(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { conversationId: string }) {
    const authUser = this.requireSocketUser(client);
    await this.conversations.requireMember(authUser.sub, body.conversationId);
    client.to(`conversation:${body.conversationId}`).emit('typing:stop', {
      conversationId: body.conversationId,
      userId: authUser.sub,
    });
  }

  @SubscribeMessage('sync:request')
  async sync(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { conversationId: string; afterSequence?: number },
  ) {
    const authUser = this.requireSocketUser(client);
    const history = await this.messages.history(authUser.sub, body.conversationId, body.afterSequence || 0, 100);
    client.emit('sync:complete', { conversationId: body.conversationId, messages: history.messages });
    return history;
  }

  @SubscribeMessage('call:invite')
  async invite(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { conversationId?: string; video?: boolean }) {
    const authUser = this.requireSocketUser(client);
    const peer = await this.directPeer(authUser.sub, body.conversationId || '');
    if (!this.isOnline(peer.other.userId)) return { available: false };
    this.server.to(`user:${peer.other.userId}`).emit('call:invite', {
      conversationId: peer.conversation.id,
      fromUserId: authUser.sub,
      fromName: peer.me?.user.profile?.displayName || peer.me?.user.username || 'Someone',
      video: body.video === true,
    });
    return { available: true };
  }

  @SubscribeMessage('call:accept')
  async accept(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { conversationId?: string }) {
    const authUser = this.requireSocketUser(client);
    const peer = await this.directPeer(authUser.sub, body.conversationId || '');
    this.server.to(`user:${peer.other.userId}`).emit('call:accept', {
      conversationId: peer.conversation.id,
      fromUserId: authUser.sub,
    });
    return { ok: true };
  }

  @SubscribeMessage('call:reject')
  async reject(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { conversationId?: string }) {
    const authUser = this.requireSocketUser(client);
    const peer = await this.directPeer(authUser.sub, body.conversationId || '');
    this.server.to(`user:${peer.other.userId}`).emit('call:reject', { conversationId: peer.conversation.id });
    return { ok: true };
  }

  @SubscribeMessage('call:hangup')
  async hangup(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { conversationId?: string }) {
    const authUser = this.requireSocketUser(client);
    const peer = await this.directPeer(authUser.sub, body.conversationId || '');
    this.server.to(`user:${peer.other.userId}`).emit('call:hangup', { conversationId: peer.conversation.id });
    return { ok: true };
  }

  @SubscribeMessage('call:offer')
  async offer(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { conversationId?: string; sdp?: unknown }) {
    const authUser = this.requireSocketUser(client);
    const peer = await this.directPeer(authUser.sub, body.conversationId || '');
    this.server.to(`user:${peer.other.userId}`).emit('call:offer', {
      conversationId: peer.conversation.id,
      sdp: body.sdp,
    });
    return { ok: true };
  }

  @SubscribeMessage('call:answer')
  async answer(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { conversationId?: string; sdp?: unknown }) {
    const authUser = this.requireSocketUser(client);
    const peer = await this.directPeer(authUser.sub, body.conversationId || '');
    this.server.to(`user:${peer.other.userId}`).emit('call:answer', {
      conversationId: peer.conversation.id,
      sdp: body.sdp,
    });
    return { ok: true };
  }

  @SubscribeMessage('call:ice')
  async ice(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { conversationId?: string; candidate?: unknown }) {
    const authUser = this.requireSocketUser(client);
    const peer = await this.directPeer(authUser.sub, body.conversationId || '');
    this.server.to(`user:${peer.other.userId}`).emit('call:ice', {
      conversationId: peer.conversation.id,
      candidate: body.candidate,
    });
    return { ok: true };
  }

  private emitPresence(conversationIds: string[], userId: string, status: 'online' | 'offline') {
    if (!this.server) return;
    for (const conversationId of conversationIds) {
      this.server.to(`conversation:${conversationId}`).emit('presence:update', { userId, status });
    }
  }

  emitNew(conversationId: string, message: unknown, userIds: string[] = []) {
    if (!this.server) return;
    this.server.to(`conversation:${conversationId}`).emit('message:new', message);
    for (const userId of userIds) {
      this.server.to(`user:${userId}`).emit('message:new', message);
    }
  }

  private requireSocketUser(client: AuthedSocket) {
    if (!client.authUser) throw new Error('Sign in required.');
    return client.authUser;
  }

  private isOnline(userId: string) {
    return (this.socketsByUser.get(userId) || 0) > 0;
  }

  private async directPeer(userId: string, conversationId: string) {
    if (!/^[a-f0-9]{24}$/i.test(conversationId)) throw new BadRequestException('That id is not valid.');
    const conversation = await this.conversations.requireMember(userId, conversationId);
    if (conversation.type !== 'DIRECT') throw new BadRequestException('Voice calls are available in direct chats.');
    const other = conversation.members.find((member) => member.userId !== userId);
    const me = conversation.members.find((member) => member.userId === userId);
    if (!other || !me) throw new NotFoundException('Conversation not found.');
    return { conversation, other, me };
  }
}

function headerToken(value: string | string[] | undefined) {
  const header = Array.isArray(value) ? value[0] : value || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}
