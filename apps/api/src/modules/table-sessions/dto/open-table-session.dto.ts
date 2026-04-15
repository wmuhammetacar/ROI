import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class OpenTableSessionDto {
  @IsString()
  tableId!: string;

  @IsOptional()
  @IsString()
  assignedWaiterId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  guestCount!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
