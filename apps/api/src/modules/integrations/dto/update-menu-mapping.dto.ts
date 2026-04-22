import { IsBoolean, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { IsCuid } from '../../../common/validators/is-cuid.decorator';

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
  @IsCuid()
  productId?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @IsCuid()
  variantId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
