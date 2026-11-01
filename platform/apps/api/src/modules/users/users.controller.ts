import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ParseObjectIdPipe } from '../../common/object-id.pipe';
import { AccessTokenPayload, CurrentAuth } from '../../common/current-auth';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateProfileDto } from './dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentAuth() auth: AccessTokenPayload) {
    return this.users.me(auth.sub);
  }

  @Patch('me')
  updateMe(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: UpdateProfileDto) {
    return this.users.updateMe(auth.sub, dto.displayName);
  }

  @Get('search')
  search(@CurrentAuth() auth: AccessTokenPayload, @Query('q') query = '') {
    return this.users.search(auth.sub, query);
  }

  @Post(':id/block')
  block(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseObjectIdPipe) id: string) {
    return this.users.block(auth.sub, id);
  }

  @Delete(':id/block')
  unblock(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseObjectIdPipe) id: string) {
    return this.users.unblock(auth.sub, id);
  }
}
