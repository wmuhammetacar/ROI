import { BadRequestException } from '@nestjs/common';

export function normalizeRoleName(name: string): string {
  const normalized = name.trim().toLowerCase();
  if (!normalized) {
    throw new BadRequestException('Role name is required');
  }

  return normalized;
}

export function normalizePermissionName(name: string): string {
  const normalized = name.trim().toLowerCase();
  if (!normalized) {
    throw new BadRequestException('Permission name is required');
  }

  return normalized;
}
