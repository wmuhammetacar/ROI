import { WaiterCallType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsCuid } from '../../../common/validators/is-cuid.decorator';

export class CreatePublicWaiterCallDto {
  @IsCuid()
  branchId!: string;

  @IsCuid()
  tableId!: string;

  @IsEnum(WaiterCallType)
  callType!: WaiterCallType;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
