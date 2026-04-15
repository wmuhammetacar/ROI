import { BadRequestException } from '@nestjs/common';

export function normalizeCategoryName(name: string): string {
  const normalized = name.trim();
  if (!normalized) {
    throw new BadRequestException('Category name is required');
  }

  return normalized;
}
