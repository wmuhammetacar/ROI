import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class PublicMenuQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  branchId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  tableId?: string;
}
