import { ArrayUnique, IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsCuid } from '../../../common/validators/is-cuid.decorator';

export class CatalogModifierSelectionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @IsCuid()
  modifierGroupId!: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsCuid({ each: true })
  optionIds?: string[];
}
