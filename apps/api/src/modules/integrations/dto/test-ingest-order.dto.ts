import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class TestIngestOrderDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  branchId?: string;

  @IsObject()
  payload!: Record<string, unknown>;
}
