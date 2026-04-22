import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CatalogModifierSelectionDto } from './catalog-modifier-selection.dto';
import { IsCuid } from '../../../common/validators/is-cuid.decorator';

export class AddCatalogOrderItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @IsCuid()
  productId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @IsCuid()
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
