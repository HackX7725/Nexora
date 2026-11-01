import { Type } from 'class-transformer';
import { IsInt, IsMongoId, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';

export class EncryptionHeaderDto {
  @IsString()
  @MaxLength(64)
  algorithm!: string;

  @IsInt()
  @Min(1)
  keyVersion!: number;
}

export class SendMessageDto {
  @IsUUID()
  clientMessageId!: string;

  @IsMongoId()
  senderDeviceId!: string;

  @IsString()
  @MaxLength(1500000)
  ciphertext!: string;

  @ValidateNested()
  @Type(() => EncryptionHeaderDto)
  encryptionHeader!: EncryptionHeaderDto;

  @IsOptional()
  @IsMongoId()
  replyToMessageId?: string;
}
