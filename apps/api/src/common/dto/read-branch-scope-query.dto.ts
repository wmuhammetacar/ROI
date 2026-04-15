import { IsOptional, IsString } from 'class-validator';

export class ReadBranchScopeQueryDto {
  @IsOptional()
  @IsString()
  branchId?: string;
}
