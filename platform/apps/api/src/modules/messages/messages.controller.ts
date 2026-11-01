import { Body, Controller, Get, Headers, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ParseObjectIdPipe } from '../../common/object-id.pipe';
import { AccessTokenPayload, CurrentAuth } from '../../common/current-auth';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SendMessageDto } from './dto';
import { MessagesService } from './messages.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get('conversations/:id/messages')
  history(
    @CurrentAuth() auth: AccessTokenPayload,
    @Param('id', ParseObjectIdPipe) id: string,
    @Query('after', new ParseIntPipe({ optional: true })) after = 0,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
  ) {
    return this.messages.history(auth.sub, id, after, limit);
  }

  @Post('conversations/:id/messages')
  send(
    @CurrentAuth() auth: AccessTokenPayload,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: SendMessageDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.messages.send(auth.sub, id, dto, idempotencyKey);
  }

  @Post('messages/:id/delivered')
  delivered(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseObjectIdPipe) id: string) {
    return this.messages.receipt(auth.sub, auth.did, id, 'DELIVERED');
  }

  @Post('messages/:id/read')
  read(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseObjectIdPipe) id: string) {
    return this.messages.receipt(auth.sub, auth.did, id, 'READ');
  }
}
