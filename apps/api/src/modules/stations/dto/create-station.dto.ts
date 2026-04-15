import { Type } from 'class-transformer';
import { StationType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateStationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(30)
  @Matches(/^[A-Za-z0-9_-]+$/)
  code!: string;

  @IsEnum(StationType)
  stationType!: StationType;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
