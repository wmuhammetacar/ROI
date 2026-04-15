import { ProductionTicketItemStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProductionTicketItemStatusDto {
  @IsEnum(ProductionTicketItemStatus)
  status!: ProductionTicketItemStatus;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
