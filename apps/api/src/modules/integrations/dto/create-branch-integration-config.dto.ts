import { BranchIntegrationConfigStatus } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsCuid } from '../../../common/validators/is-cuid.decorator';

export class CreateBranchIntegrationConfigDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @IsCuid()
  branchId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @IsCuid()
  providerId!: string;

  @IsOptional()
  @IsEnum(BranchIntegrationConfigStatus)
  status?: BranchIntegrationConfigStatus;

  @IsOptional()
  @IsObject()
  credentialsJson?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  settingsJson?: Record<string, unknown>;
}
