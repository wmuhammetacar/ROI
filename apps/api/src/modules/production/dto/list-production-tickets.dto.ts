import { ProductionTicketStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListProductionTicketsDto {
  @IsOptional()
  @IsString()
  stationId?: string;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsEnum(ProductionTicketStatus)
  status?: ProductionTicketStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 100;
}
