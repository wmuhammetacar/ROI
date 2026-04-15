import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class OpenRegisterShiftDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  openingCashAmount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}
