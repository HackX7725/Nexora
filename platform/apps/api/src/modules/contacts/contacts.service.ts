import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(ownerId: string) {
    const rows = await this.prisma.contact.findMany({
      where: { ownerId },
      include: { contactUser: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return {
      contacts: rows.map((row) => ({
        userId: row.contactUserId,
        username: row.contactUser.username,
        displayName: row.contactUser.profile?.displayName || row.contactUser.username,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async add(ownerId: string, username: string) {
    const name = username.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { username: name },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException('No account uses that username.');
    if (user.id === ownerId) throw new BadRequestException('You cannot add yourself.');
    try {
      const contact = await this.prisma.contact.create({
        data: { ownerId, contactUserId: user.id },
      });
      return {
        userId: user.id,
        username: user.username,
        displayName: user.profile?.displayName || user.username,
        createdAt: contact.createdAt.toISOString(),
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('That person is already in your contacts.');
      }
      throw error;
    }
  }

  async remove(ownerId: string, contactUserId: string) {
    await this.prisma.contact.deleteMany({ where: { ownerId, contactUserId } });
    return { status: 'removed' };
  }
}
