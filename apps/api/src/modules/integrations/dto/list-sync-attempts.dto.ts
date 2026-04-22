import { IntegrationSyncDirection, IntegrationSyncStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ReadBranchScopeQueryDto } from '../../../common/dto/read-branch-scope-query.dto';
import { IsCuid } from '../../../common/validators/is-cuid.decorator';

export class ListSyncAttemptsDto extends ReadBranchScopeQueryDto {
  @IsOptional()
  @IsString()
  @IsCuid()
  providerId?: string;

  @IsOptional()
  @IsEnum(IntegrationSyncDirection)
  direction?: IntegrationSyncDirection;

  @IsOptional()
  @IsEnum(IntegrationSyncStatus)
  status?: IntegrationSyncStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 100;
}
