import { BadRequestException, ConflictException } from '@nestjs/common';
import { TableStatus } from '@prisma/client';

export function normalizeTableName(name: string): string {
  const normalized = name.trim();
  if (!normalized) {
    throw new BadRequestException('Table name is required');
  }

  return normalized;
}

export function ensureManualStatusChangeAllowed(
  openSessionCount: number,
  nextStatus: TableStatus,
): void {
  if (openSessionCount > 0 && nextStatus !== TableStatus.OCCUPIED) {
    throw new ConflictException('Table with open session must stay OCCUPIED');
  }

  if (openSessionCount === 0 && nextStatus === TableStatus.OCCUPIED) {
    throw new ConflictException('Open a table session before marking table as OCCUPIED');
  }
}
