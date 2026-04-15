import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ReadBranchScopeQueryDto } from '../../../common/dto/read-branch-scope-query.dto';

export class ReportsLimitDto extends ReadBranchScopeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 20;
}

export class ReportsScopeDto extends ReportsLimitDto {
  @IsOptional()
  @IsString()
  shiftId?: string;
}
