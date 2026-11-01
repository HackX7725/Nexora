import { IsString, Length, Matches } from 'class-validator';

export class AddContactDto {
  @IsString()
  @Length(3, 32)
  @Matches(/^[a-zA-Z0-9_]+$/)
  username!: string;
}
