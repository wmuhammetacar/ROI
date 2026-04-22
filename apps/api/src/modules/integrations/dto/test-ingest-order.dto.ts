import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsCuid } from '../../../common/validators/is-cuid.decorator';

export class TestIngestOrderDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @IsCuid()
  branchId?: string;

  @IsObject()
  payload!: Record<string, unknown>;
}
