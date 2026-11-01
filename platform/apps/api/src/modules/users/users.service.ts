import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException('Account not found.');
    return {
      id: user.id,
      username: user.username,
      displayName: user.profile?.displayName || user.username,
      email: user.email,
      phone: user.phone,
    };
  }

  async updateMe(userId: string, displayName: string) {
    await this.prisma.userProfile.update({
      where: { userId },
      data: { displayName: displayName.trim() },
    });
    return this.me(userId);
  }

  async search(userId: string, query: string) {
    const trimmed = query.trim();
    const q = trimmed.toLowerCase();
    if (q.length < 2) return { users: [] };
    const users = await this.prisma.user.findMany({
      where: {
        id: { not: userId },
        OR: [
          { username: { contains: q } },
          { profile: { is: { displayName: { contains: trimmed } } } },
        ],
      },
      include: { profile: true },
      take: 20,
      orderBy: { username: 'asc' },
    });
    return {
      users: users.map((user) => ({
        id: user.id,
        username: user.username,
        displayName: user.profile?.displayName || user.username,
      })),
    };
  }

  async block(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) throw new NotFoundException('Account not found.');
    const blocked = await this.prisma.user.findUnique({ where: { id: blockedId } });
    if (!blocked) throw new NotFoundException('Account not found.');
    await this.prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      update: {},
      create: { blockerId, blockedId },
    });
    return { status: 'blocked' };
  }

  async unblock(blockerId: string, blockedId: string) {
    await this.prisma.userBlock.deleteMany({ where: { blockerId, blockedId } });
    return { status: 'unblocked' };
  }
}
