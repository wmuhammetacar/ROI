import { ModifierSelectionType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateModifierGroupDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsEnum(ModifierSelectionType)
  selectionType!: ModifierSelectionType;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  minSelect!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxSelect!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder!: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
