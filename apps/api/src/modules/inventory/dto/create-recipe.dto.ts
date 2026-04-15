import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRecipeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  productId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  productVariantId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
