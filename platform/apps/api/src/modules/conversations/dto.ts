import { ArrayMaxSize, IsArray, IsIn, IsMongoId, IsOptional, IsString, Length } from 'class-validator';

export class CreateConversationDto {
  @IsIn(['DIRECT', 'GROUP'])
  type!: 'DIRECT' | 'GROUP';

  @IsOptional()
  @IsMongoId()
  participantId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  title?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsMongoId({ each: true })
  memberIds?: string[];
}
