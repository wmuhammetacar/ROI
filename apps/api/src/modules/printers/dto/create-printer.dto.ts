import { PrinterRole, PrinterType } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { IsCuid } from '../../../common/validators/is-cuid.decorator';

export class CreatePrinterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsEnum(PrinterRole)
  printerRole!: PrinterRole;

  @IsEnum(PrinterType)
  type!: PrinterType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ipAddress?: string;

  @IsOptional()
  @IsCuid()
  stationId?: string;

  @IsOptional()
  @IsCuid()
  fallbackPrinterId?: string;

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
