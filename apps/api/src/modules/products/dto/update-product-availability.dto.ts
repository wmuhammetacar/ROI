import { Type } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class UpdateProductAvailabilityDto {
  @Type(() => Boolean)
  @IsBoolean()
  isAvailable!: boolean;
}
