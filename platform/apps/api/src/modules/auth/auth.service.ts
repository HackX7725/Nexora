import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto, RefreshDto, RegisterDto, ResendLoginDto, VerifyLoginDto } from './dto';
import {
  LOGIN_CODE_TTL_MS,
  assessLoginCode,
  generateLoginCode,
  hashLoginCode,
  loginCodeError,
  maskEmail,
  resendWaitSeconds,
  scrambledCodeHash,
} from './login-code';
import { MailService } from './mail.service';

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash = '';

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async onModuleInit() {
    this.dummyHash = await argon2.hash('platform-dummy-password', { type: argon2.argon2id });
  }

  async register(dto: RegisterDto) {
    const email = normalizeEmail(dto.email);
    const phone = normalizePhone(dto.phone);
    if (!email) {
      throw new BadRequestException('Add an email address.');
    }
    if (dto.phone && !phone) {
      throw new BadRequestException('Enter a valid phone number.');
    }
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            username: dto.username.toLowerCase(),
            email,
            phone,
            passwordHash,
            profile: { create: { displayName: dto.username.toLowerCase() } },
          },
        });
        const device = await tx.device.create({
          data: {
            userId: user.id,
            name: dto.deviceName || 'This device',
            platform: dto.platform || 'WEB',
          },
        });
        const session = await this.openSession(tx, user.id, device.id);
        return { user, device, session };
      });
      return this.tokenResponse(created.user.id, created.session.id, created.device.id, created.session.refreshToken, {
        id: created.user.id,
        username: created.user.username,
        displayName: dto.username.toLowerCase(),
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An account with those details already exists.');
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const identifier = dto.identifier.trim().toLowerCase();
    const phone = normalizePhone(dto.identifier);
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { username: identifier },
          ...(phone ? [{ phone }] : []),
        ],
      },
      include: { profile: true },
    });
    const passwordOk = await argon2.verify(user?.passwordHash || this.dummyHash, dto.password);
    if (!user || !passwordOk) {
      throw new UnauthorizedException('Those credentials are not valid.');
    }
    if (!user.email) {
      throw new BadRequestException('This account has no email address for a login code.');
    }
    const code = generateLoginCode();
    const now = new Date();
    await this.prisma.loginChallenge.deleteMany({ where: { userId: user.id } });
    const challenge = await this.prisma.loginChallenge.create({
      data: {
        userId: user.id,
        codeHash: hashLoginCode(code),
        expiresAt: new Date(now.getTime() + LOGIN_CODE_TTL_MS),
        lastSentAt: now,
        deviceId: dto.deviceId || null,
        deviceName: dto.deviceName || 'This device',
        platform: dto.platform || 'WEB',
      },
    });
    try {
      await this.mail.sendLoginCode(user.email, code);
    } catch (error) {
      await this.prisma.loginChallenge.delete({ where: { id: challenge.id } }).catch(() => undefined);
      throw error;
    }
    return {
      requiresVerification: true,
      challengeId: challenge.id,
      maskedEmail: maskEmail(user.email),
      resendAvailableIn: 60,
    };
  }

  async verifyLogin(dto: VerifyLoginDto) {
    const challenge = await this.prisma.loginChallenge.findUnique({
      where: { id: dto.challengeId },
      include: { user: { include: { profile: true } } },
    });
    if (!challenge) throw new BadRequestException(loginCodeError('missing'));

    const verdict = assessLoginCode({
      storedHash: challenge.codeHash,
      attempts: challenge.attempts,
      expiresAt: challenge.expiresAt.getTime(),
      now: Date.now(),
      code: dto.code,
    });
    if (!verdict.ok) {
      if (verdict.reason === 'expired') {
        await this.prisma.loginChallenge.delete({ where: { id: challenge.id } }).catch(() => undefined);
      } else {
        await this.prisma.loginChallenge.update({
          where: { id: challenge.id },
          data: {
            attempts: verdict.attempts,
            ...(verdict.scramble ? { codeHash: scrambledCodeHash() } : {}),
          },
        });
      }
      throw new BadRequestException(loginCodeError(verdict.reason));
    }

    const opened = await this.prisma.$transaction(async (tx) => {
      const removed = await tx.loginChallenge.deleteMany({
        where: { id: challenge.id, codeHash: challenge.codeHash },
      });
      if (removed.count !== 1) throw new BadRequestException(loginCodeError('missing'));
      const existingDevice = challenge.deviceId
        ? await tx.device.findFirst({ where: { id: challenge.deviceId, userId: challenge.userId } })
        : null;
      const device = existingDevice || await tx.device.create({
        data: {
          userId: challenge.userId,
          name: challenge.deviceName,
          platform: challenge.platform,
        },
      });
      const session = await this.openSession(tx, challenge.userId, device.id);
      return { device, session };
    });

    return this.tokenResponse(challenge.userId, opened.session.id, opened.device.id, opened.session.refreshToken, {
      id: challenge.user.id,
      username: challenge.user.username,
      displayName: challenge.user.profile?.displayName || challenge.user.username,
    });
  }

  async resendLoginCode(dto: ResendLoginDto) {
    const challenge = await this.prisma.loginChallenge.findUnique({
      where: { id: dto.challengeId },
      include: { user: true },
    });
    if (!challenge || !challenge.user.email) throw new BadRequestException(loginCodeError('missing'));

    const wait = resendWaitSeconds(challenge.lastSentAt.getTime(), Date.now());
    if (wait > 0) {
      throw new HttpException(
        { message: `Wait ${wait} seconds before resending.`, retryAfter: wait },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = generateLoginCode();
    await this.mail.sendLoginCode(challenge.user.email, code);
    const now = new Date();
    await this.prisma.loginChallenge.update({
      where: { id: challenge.id },
      data: {
        codeHash: hashLoginCode(code),
        attempts: 0,
        expiresAt: new Date(now.getTime() + LOGIN_CODE_TTL_MS),
        lastSentAt: now,
      },
    });
    return { resendAvailableIn: 60 };
  }

  async refresh(dto: RefreshDto) {
    const hash = tokenHash(dto.refreshToken);
    const current = await this.prisma.session.findUnique({ where: { refreshTokenHash: hash } });
    if (!current) {
      const reused = await this.prisma.session.findUnique({ where: { previousTokenHash: hash } });
      if (reused && !reused.revokedAt) {
        await this.prisma.session.update({ where: { id: reused.id }, data: { revokedAt: new Date() } });
      }
      throw new UnauthorizedException('Sign in required.');
    }
    if (current.revokedAt || current.expiresAt < new Date()) {
      throw new UnauthorizedException('Sign in required.');
    }
    const refreshToken = randomBytes(32).toString('base64url');
    await this.prisma.session.update({
      where: { id: current.id },
      data: {
        previousTokenHash: current.refreshTokenHash,
        refreshTokenHash: tokenHash(refreshToken),
        expiresAt: this.refreshExpiry(),
      },
    });
    return this.tokenResponse(current.userId, current.id, current.deviceId, refreshToken);
  }

  async logout(sessionId: string) {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { status: 'signed-out' };
  }

  async logoutAll(userId: string) {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { status: 'signed-out' };
  }

  async sessions(userId: string) {
    const rows = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { device: true },
      orderBy: { createdAt: 'desc' },
    });
    return {
      sessions: rows.map((session) => ({
        id: session.id,
        deviceId: session.deviceId,
        deviceName: session.device.name,
        platform: session.device.platform,
        createdAt: session.createdAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
      })),
    };
  }

  private async openSession(db: Prisma.TransactionClient | PrismaService, userId: string, deviceId: string) {
    const refreshToken = randomBytes(32).toString('base64url');
    const session = await db.session.create({
      data: {
        userId,
        deviceId,
        refreshTokenHash: tokenHash(refreshToken),
        expiresAt: this.refreshExpiry(),
      },
    });
    return { id: session.id, refreshToken };
  }

  private tokenResponse(
    userId: string,
    sessionId: string,
    deviceId: string,
    refreshToken: string,
    user?: { id: string; username: string; displayName: string },
  ) {
    const accessToken = this.jwt.sign({ sub: userId, sid: sessionId, did: deviceId });
    return { accessToken, refreshToken, deviceId, ...(user ? { user } : {}) };
  }

  private refreshExpiry() {
    const days = Number(this.config.get<string>('JWT_REFRESH_DAYS') || 30);
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
}

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function normalizeEmail(value?: string) {
  const email = value?.trim().toLowerCase() || '';
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException('Enter a valid email address.');
  }
  return email;
}

function normalizePhone(value?: string) {
  const raw = value?.trim() || '';
  if (!raw) return null;
  const phone = raw.startsWith('+') ? `+${raw.slice(1).replace(/\D/g, '')}` : raw.replace(/\D/g, '');
  if (phone.replace(/\D/g, '').length < 8) return null;
  return phone;
}
