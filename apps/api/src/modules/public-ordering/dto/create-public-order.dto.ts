import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { IsCuid } from '../../../common/validators/is-cuid.decorator';
import { PublicOrderItemDto } from './public-order-item.dto';

export class CreatePublicOrderDto {
  @IsString()
  @IsCuid()
  branchId!: string;

  @IsOptional()
  @IsString()
  @IsCuid()
  tableId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientSessionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
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

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PublicOrderItemDto)
  items!: PublicOrderItemDto[];
}
