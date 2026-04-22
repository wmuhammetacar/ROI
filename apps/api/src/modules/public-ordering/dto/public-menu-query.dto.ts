import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsCuid } from '../../../common/validators/is-cuid.decorator';

export class PublicMenuQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @IsCuid()
  branchId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @IsCuid()
  tableId?: string;
}
