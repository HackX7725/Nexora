import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ParseObjectIdPipe } from '../../common/object-id.pipe';
import { AccessTokenPayload, CurrentAuth } from '../../common/current-auth';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Post()
  create(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: CreateConversationDto) {
    return this.conversations.create(auth.sub, dto);
  }

  @Get()
  list(@CurrentAuth() auth: AccessTokenPayload) {
    return this.conversations.list(auth.sub);
  }

  @Get(':id')
  get(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseObjectIdPipe) id: string) {
    return this.conversations.get(auth.sub, id);
  }
}
