import { BadRequestException } from '@nestjs/common';

export function normalizeFloorName(name: string): string {
  const normalized = name.trim();
  if (!normalized) {
    throw new BadRequestException('Floor name is required');
  }

  return normalized;
}
