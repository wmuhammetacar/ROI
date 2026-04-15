import { BranchIntegrationConfigStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ReadBranchScopeQueryDto } from '../../../common/dto/read-branch-scope-query.dto';

export class ListBranchIntegrationConfigsDto extends ReadBranchScopeQueryDto {
  @IsOptional()
  @IsString()
  providerId?: string;

  @IsOptional()
  @IsEnum(BranchIntegrationConfigStatus)
  status?: BranchIntegrationConfigStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 100;
}
