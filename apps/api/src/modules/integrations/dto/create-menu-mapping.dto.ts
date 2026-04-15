import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMenuMappingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  branchId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  providerId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  externalItemId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  externalItemName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  productId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  variantId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
