import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  did: string;
}

export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AccessTokenPayload => {
    return context.switchToHttp().getRequest().user;
  },
);
