import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(7)
  @MaxLength(24)
  phonePrimary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  phoneSecondary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  phoneTertiary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  addressLine?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
