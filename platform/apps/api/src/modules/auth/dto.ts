import { IsEmail, IsIn, IsMongoId, IsOptional, IsString, Length, Matches } from 'class-validator';

const PLATFORMS = ['WEB', 'WINDOWS', 'ANDROID', 'IOS'] as const;

export class RegisterDto {
  @IsString()
  @Length(3, 32)
  @Matches(/^[a-z0-9_]+$/)
  username!: string;

  @IsString()
  @Length(8, 128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/)
  password!: string;

  @IsEmail()
  @Length(3, 254)
  email!: string;

  @IsOptional()
  @IsString()
  @Length(8, 20)
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  deviceName?: string;

  @IsOptional()
  @IsIn(PLATFORMS)
  platform?: (typeof PLATFORMS)[number];
}

export class LoginDto {
  @IsString()
  @Length(3, 254)
  identifier!: string;

  @IsString()
  @Length(8, 128)
  password!: string;

  @IsOptional()
  @IsMongoId()
  deviceId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  deviceName?: string;

  @IsOptional()
  @IsIn(PLATFORMS)
  platform?: (typeof PLATFORMS)[number];
}

export class VerifyLoginDto {
  @IsMongoId()
  challengeId!: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}

export class ResendLoginDto {
  @IsMongoId()
  challengeId!: string;
}

export class RefreshDto {
  @IsString()
  @Length(20, 200)
  refreshToken!: string;
}
