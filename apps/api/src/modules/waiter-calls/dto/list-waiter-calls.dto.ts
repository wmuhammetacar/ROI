import { IsEnum, IsOptional } from 'class-validator';
import { WaiterCallStatus } from '@prisma/client';
import { ReadBranchScopeQueryDto } from '../../../common/dto/read-branch-scope-query.dto';

export class ListWaiterCallsDto extends ReadBranchScopeQueryDto {
  @IsOptional()
  @IsEnum(WaiterCallStatus)
  status?: WaiterCallStatus;
}
