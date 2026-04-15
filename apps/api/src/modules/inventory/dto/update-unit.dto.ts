import { UnitKind } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateUnitDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  @Matches(/^[A-Za-z0-9._-]+$/)
  code?: string;

  @IsOptional()
  @IsEnum(UnitKind)
  kind?: UnitKind;
}
