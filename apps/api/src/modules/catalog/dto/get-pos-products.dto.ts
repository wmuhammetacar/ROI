import { IsBooleanString, IsOptional } from 'class-validator';
import { ReadBranchScopeQueryDto } from '../../../common/dto/read-branch-scope-query.dto';

export class GetPosProductsDto extends ReadBranchScopeQueryDto {
  @IsOptional()
  @IsBooleanString()
  includeInactive?: string;

  @IsOptional()
  @IsBooleanString()
  includeUnavailable?: string;

  @IsOptional()
  @IsBooleanString()
  routeSafe?: string;
}
