import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CloseRegisterShiftDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  closingCashAmountActual!: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}
