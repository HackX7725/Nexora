import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccessTokenPayload } from '../../common/current-auth';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    request.user = await authenticateAccessToken(
      request.headers.authorization,
      this.jwt,
      this.prisma,
    );
    return true;
  }
}

export async function authenticateAccessToken(
  authorization: string | undefined,
  jwt: JwtService,
  prisma: PrismaService,
): Promise<AccessTokenPayload> {
  const header = authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new UnauthorizedException('Sign in required.');
  let payload: AccessTokenPayload;
  try {
    payload = jwt.verify<AccessTokenPayload>(token);
  } catch {
    throw new UnauthorizedException('Sign in required.');
  }
  const session = await prisma.session.findUnique({ where: { id: payload.sid } });
  if (!session || session.revokedAt || session.expiresAt < new Date() || session.userId !== payload.sub) {
    throw new UnauthorizedException('Sign in required.');
  }
  return payload;
}
