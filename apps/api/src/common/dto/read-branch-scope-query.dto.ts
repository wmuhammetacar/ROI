import { IsOptional, IsString } from 'class-validator';
import { IsCuid } from '../validators/is-cuid.decorator';

export class ReadBranchScopeQueryDto {
  @IsOptional()
  @IsString()
  @IsCuid()
  branchId?: string;
}
