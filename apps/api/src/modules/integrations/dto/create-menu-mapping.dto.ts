import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsCuid } from '../../../common/validators/is-cuid.decorator';

export class CreateMenuMappingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @IsCuid()
  branchId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @IsCuid()
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
  @IsCuid()
  productId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @IsCuid()
  variantId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
