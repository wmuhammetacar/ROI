import { Type } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class UpdateProductActiveStateDto {
  @Type(() => Boolean)
  @IsBoolean()
  isActive!: boolean;
}
