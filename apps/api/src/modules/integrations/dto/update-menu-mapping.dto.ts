import { IsBoolean, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class UpdateMenuMappingDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  externalItemName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  productId?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  variantId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
