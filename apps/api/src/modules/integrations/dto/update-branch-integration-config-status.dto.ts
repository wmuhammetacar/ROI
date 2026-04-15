import { BranchIntegrationConfigStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateBranchIntegrationConfigStatusDto {
  @IsEnum(BranchIntegrationConfigStatus)
  status!: BranchIntegrationConfigStatus;
}
