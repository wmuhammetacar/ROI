import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { WaiterCallType } from '@prisma/client';
import { IsCuid } from '../../../common/validators/is-cuid.decorator';

export class CreateWaiterCallDto {
  @IsString()
  @IsCuid()
  tableId!: string;

  @IsOptional()
  @IsEnum(WaiterCallType)
  callType?: WaiterCallType;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
