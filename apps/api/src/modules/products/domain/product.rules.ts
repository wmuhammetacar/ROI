import { BadRequestException } from '@nestjs/common';
import { ProductType } from '@prisma/client';

export function normalizeProductName(name: string): string {
  const normalized = name.trim();
  if (!normalized) {
    throw new BadRequestException('Product name is required');
  }

  return normalized;
}

export function normalizeVariantName(name: string): string {
  const normalized = name.trim();
  if (!normalized) {
    throw new BadRequestException('Variant name is required');
  }

  return normalized;
}

export function assertProductTypeSupportsVariants(productType: ProductType): void {
  if (productType !== ProductType.VARIABLE) {
    throw new BadRequestException('Only VARIABLE products can have variants');
  }
}
