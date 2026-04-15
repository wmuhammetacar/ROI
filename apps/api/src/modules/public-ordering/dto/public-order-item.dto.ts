import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { CatalogModifierSelectionDto } from '../../orders/dto/catalog-modifier-selection.dto';

export class PublicOrderItemDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsString()
  variantId?: string | null;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogModifierSelectionDto)
  modifierSelections?: CatalogModifierSelectionDto[];
}
