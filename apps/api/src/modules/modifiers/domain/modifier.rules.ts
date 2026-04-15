import { BadRequestException } from '@nestjs/common';
import { ModifierSelectionType } from '@prisma/client';

export function normalizeModifierGroupName(name: string): string {
  const normalized = name.trim();
  if (!normalized) {
    throw new BadRequestException('Modifier group name is required');
  }

  return normalized;
}

export function normalizeModifierOptionName(name: string): string {
  const normalized = name.trim();
  if (!normalized) {
    throw new BadRequestException('Modifier option name is required');
  }

  return normalized;
}

export function validateSelectionConfig(
  selectionType: ModifierSelectionType,
  minSelect: number,
  maxSelect: number,
): void {
  if (minSelect < 0 || maxSelect < 0) {
    throw new BadRequestException('minSelect and maxSelect must be >= 0');
  }

  if (maxSelect < minSelect) {
    throw new BadRequestException('maxSelect must be greater than or equal to minSelect');
  }

  if (selectionType === ModifierSelectionType.SINGLE) {
    if (maxSelect !== 1) {
      throw new BadRequestException('SINGLE selectionType requires maxSelect to be 1');
    }

    if (minSelect > 1) {
      throw new BadRequestException('SINGLE selectionType requires minSelect to be 0 or 1');
    }
  }
}
