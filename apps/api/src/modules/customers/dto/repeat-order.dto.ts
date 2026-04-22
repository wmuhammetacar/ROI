import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RepeatCustomerOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
