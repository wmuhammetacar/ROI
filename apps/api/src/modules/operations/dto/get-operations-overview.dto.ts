import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ReadBranchScopeQueryDto } from '../../../common/dto/read-branch-scope-query.dto';

export class GetOperationsOverviewDto extends ReadBranchScopeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  orderLimit?: number;
}
