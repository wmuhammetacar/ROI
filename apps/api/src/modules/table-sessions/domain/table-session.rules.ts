import { ConflictException } from '@nestjs/common';
import { TableStatus } from '@prisma/client';

export function ensureTableAllowsSessionOpen(status: TableStatus): void {
  if (status === TableStatus.OUT_OF_SERVICE) {
    throw new ConflictException('Table is OUT_OF_SERVICE and cannot open a session');
  }
}
