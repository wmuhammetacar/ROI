import { BadRequestException } from '@nestjs/common';

export function enforceBranchMembership(branchId: string): void {
  if (!branchId || branchId.trim().length === 0) {
    throw new BadRequestException('User must belong to a branch');
  }
}

export function normalizeRoleNames(roleNames: string[] | undefined, fallback: string[]): string[] {
  const base = roleNames && roleNames.length > 0 ? roleNames : fallback;
  return Array.from(new Set(base.map((name) => name.trim().toLowerCase()).filter(Boolean)));
}
