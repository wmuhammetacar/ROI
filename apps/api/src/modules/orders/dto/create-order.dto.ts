import { ServiceType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsCuid } from '../../../common/validators/is-cuid.decorator';

export class CreateOrderDto {
  @IsEnum(ServiceType)
  serviceType!: ServiceType;

  @IsOptional()
  @IsString()
  @IsCuid()
  tableSessionId?: string;

  @IsOptional()
  @IsString()
  @IsCuid()
  customerId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  customerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  customerPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
