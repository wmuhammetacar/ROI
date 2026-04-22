import { RegisterShiftStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ReadBranchScopeQueryDto } from '../../../common/dto/read-branch-scope-query.dto';
import { IsCuid } from '../../../common/validators/is-cuid.decorator';

export class ListRegisterShiftsDto extends ReadBranchScopeQueryDto {
  @IsOptional()
  @IsEnum(RegisterShiftStatus)
  status?: RegisterShiftStatus;

  @IsOptional()
  @IsString()
  @IsCuid()
  openedByUserId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 100;
}
