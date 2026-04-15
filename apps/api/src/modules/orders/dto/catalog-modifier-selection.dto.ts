import { ArrayUnique, IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CatalogModifierSelectionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  modifierGroupId!: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  optionIds?: string[];
}

