import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../../common/current-auth';
import { AccessTokenPayload } from '../../common/current-auth';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto, RegisterDto, ResendLoginDto, VerifyLoginDto } from './dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('verify-login')
  verifyLogin(@Body() dto: VerifyLoginDto) {
    return this.auth.verifyLogin(dto);
  }

  @Post('resend-login-code')
  resendLoginCode(@Body() dto: ResendLoginDto) {
    return this.auth.resendLoginCode(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@CurrentAuth() auth: AccessTokenPayload) {
    return this.auth.logout(auth.sid);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  logoutAll(@CurrentAuth() auth: AccessTokenPayload) {
    return this.auth.logoutAll(auth.sub);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  sessions(@CurrentAuth() auth: AccessTokenPayload) {
    return this.auth.sessions(auth.sub);
  }
}
