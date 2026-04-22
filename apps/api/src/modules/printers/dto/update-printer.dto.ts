import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PrinterRole, PrinterType } from '@prisma/client';
import { IsCuid } from '../../../common/validators/is-cuid.decorator';

export class UpdatePrinterDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsEnum(PrinterRole)
  printerRole?: PrinterRole;

  @IsOptional()
  @IsEnum(PrinterType)
  type?: PrinterType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ipAddress?: string;

  @IsOptional()
  @IsCuid()
  stationId?: string | null;

  @IsOptional()
  @IsCuid()
  fallbackPrinterId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  copyCount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  priority?: number;
}
