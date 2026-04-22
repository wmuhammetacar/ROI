import { IsBoolean } from 'class-validator';

export class SetUserActiveStateDto {
  @IsBoolean()
  isActive!: boolean;
}
