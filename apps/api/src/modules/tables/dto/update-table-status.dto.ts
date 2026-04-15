import { TableStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateTableStatusDto {
  @IsEnum(TableStatus)
  status!: TableStatus;
}
