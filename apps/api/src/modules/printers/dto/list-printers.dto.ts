import { PrinterRole } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { ReadBranchScopeQueryDto } from '../../../common/dto/read-branch-scope-query.dto';
import { IsCuid } from '../../../common/validators/is-cuid.decorator';

export class ListPrintersDto extends ReadBranchScopeQueryDto {
  @IsOptional()
  @IsEnum(PrinterRole)
  printerRole?: PrinterRole;

  @IsOptional()
  @IsCuid()
  stationId?: string;
}
