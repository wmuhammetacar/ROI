import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsString, Min } from 'class-validator';

export class CreateProductModifierGroupLinkDto {
  @IsString()
  modifierGroupId!: string;

  @Type(() => Boolean)
  @IsBoolean()
  isRequired!: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder!: number;
}
