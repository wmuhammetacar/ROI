import { BranchIntegrationConfigStatus } from '@prisma/client';
import { IsEnum, IsObject, IsOptional } from 'class-validator';

export class UpdateBranchIntegrationConfigDto {
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
