import { IsBoolean } from 'class-validator';

export class UpdateStationActiveStateDto {
  @IsBoolean()
  isActive!: boolean;
}
