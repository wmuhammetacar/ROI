import { PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsCuid } from '../../../common/validators/is-cuid.decorator';

export class CreateOrderPaymentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @IsCuid()
  registerShiftId!: string;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}
