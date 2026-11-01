import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ParseObjectIdPipe } from '../../common/object-id.pipe';
import { AccessTokenPayload, CurrentAuth } from '../../common/current-auth';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ContactsService } from './contacts.service';
import { AddContactDto } from './dto';

@Controller('contacts')
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  list(@CurrentAuth() auth: AccessTokenPayload) {
    return this.contacts.list(auth.sub);
  }

  @Post()
  add(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: AddContactDto) {
    return this.contacts.add(auth.sub, dto.username);
  }

  @Delete(':userId')
  remove(@CurrentAuth() auth: AccessTokenPayload, @Param('userId', ParseObjectIdPipe) userId: string) {
    return this.contacts.remove(auth.sub, userId);
  }
}
