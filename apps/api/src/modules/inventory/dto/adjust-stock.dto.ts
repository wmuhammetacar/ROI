import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { StockAdjustmentType } from '../domain/inventory.rules';

export class AdjustStockDto {
  @IsEnum(StockAdjustmentType)
  adjustmentType!: StockAdjustmentType;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}
