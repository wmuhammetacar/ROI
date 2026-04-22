import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class AddOrderItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  productNameSnapshot!: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  stationCode?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}
