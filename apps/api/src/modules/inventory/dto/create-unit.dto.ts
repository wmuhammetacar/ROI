import { UnitKind } from '@prisma/client';
import { IsEnum, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateUnitDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  @Matches(/^[A-Za-z0-9._-]+$/)
  code!: string;

  @IsEnum(UnitKind)
  kind!: UnitKind;
}
