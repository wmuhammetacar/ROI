import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';

export class UpdateIngredientDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Matches(/^[A-Za-z0-9._-]+$/)
  sku?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  unitId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  lowStockThreshold?: number;
}
