import { BranchIntegrationConfigStatus } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateBranchIntegrationConfigDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  branchId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
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
