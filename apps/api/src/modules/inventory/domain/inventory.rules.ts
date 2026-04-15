import { BadRequestException, ConflictException } from '@nestjs/common';
import { StockMovementType } from '@prisma/client';

export enum StockAdjustmentType {
  PLUS = 'PLUS',
  MINUS = 'MINUS',
}

export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

export function assertRecipeTargetExclusive(productId?: string | null, productVariantId?: string | null): void {
  const hasProduct = Boolean(productId);
  const hasVariant = Boolean(productVariantId);

  if ((hasProduct && hasVariant) || (!hasProduct && !hasVariant)) {
    throw new BadRequestException('Recipe must link to exactly one target: productId or productVariantId');
  }
}

export function resolveMovementTypeFromAdjustment(type: StockAdjustmentType): StockMovementType {
  if (type === StockAdjustmentType.PLUS) {
    return StockMovementType.ADJUSTMENT_PLUS;
  }

  return StockMovementType.ADJUSTMENT_MINUS;
}

export function assertMovementQuantityPositive(quantity: number): void {
  if (quantity <= 0) {
    throw new BadRequestException('Quantity must be greater than zero');
  }
}

export function assertStockSufficient(balanceAfterNegative: boolean, message: string): void {
  if (balanceAfterNegative) {
    throw new ConflictException(message);
  }
}
