import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateBranchPriceOverrideDto } from './dto/create-branch-price-override.dto';
import { UpdateBranchPriceOverrideDto } from './dto/update-branch-price-override.dto';

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createOverride(
    branchId: string,
    productId: string,
    actorUserId: string,
    dto: CreateBranchPriceOverrideDto,
  ) {
    const product = await this.getProductInBranch(branchId, productId);
    const variant = await this.resolveVariant(product.id, dto.variantId);

    await this.ensureUniqueOverride(branchId, product.id, variant?.id);

    const created = await this.prisma.branchPriceOverride.create({
      data: {
        branchId,
        productId: product.id,
        variantId: variant?.id,
        price: new Prisma.Decimal(dto.price),
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'CREATE_BRANCH_PRICE_OVERRIDE',
      entity: 'branch_price_override',
      metadata: {
        branchPriceOverrideId: created.id,
        branchId,
        productId: product.id,
        variantId: variant?.id ?? null,
      },
    });

    return created;
  }

  async listOverrides(branchId: string, productId: string) {
    const product = await this.getProductInBranch(branchId, productId);

    return this.prisma.branchPriceOverride.findMany({
      where: {
        branchId,
        productId: product.id,
      },
      include: {
        variant: true,
      },
      orderBy: [{ variantId: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async updateOverride(
    branchId: string,
    productId: string,
    priceId: string,
    actorUserId: string,
    dto: UpdateBranchPriceOverrideDto,
  ) {
    const product = await this.getProductInBranch(branchId, productId);

    const existing = await this.prisma.branchPriceOverride.findFirst({
      where: {
        id: priceId,
        branchId,
        productId: product.id,
      },
    });

    if (!existing) {
      throw new NotFoundException('Branch price override not found');
    }

    const resolvedVariant =
      dto.variantId !== undefined
        ? await this.resolveVariant(product.id, dto.variantId || undefined)
        : existing.variantId
          ? await this.resolveVariant(product.id, existing.variantId)
          : null;

    await this.ensureUniqueOverride(branchId, product.id, resolvedVariant?.id, existing.id);

    const updated = await this.prisma.branchPriceOverride.update({
      where: {
        id: existing.id,
      },
      data: {
        variantId: dto.variantId !== undefined ? resolvedVariant?.id ?? null : existing.variantId,
        price: dto.price !== undefined ? new Prisma.Decimal(dto.price) : existing.price,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'UPDATE_BRANCH_PRICE_OVERRIDE',
      entity: 'branch_price_override',
      metadata: {
        branchPriceOverrideId: existing.id,
        branchId,
        productId: product.id,
      },
    });

    return updated;
  }

  async deleteOverride(
    branchId: string,
    productId: string,
    priceId: string,
    actorUserId: string,
  ) {
    const product = await this.getProductInBranch(branchId, productId);

    const existing = await this.prisma.branchPriceOverride.findFirst({
      where: {
        id: priceId,
        branchId,
        productId: product.id,
      },
    });

    if (!existing) {
      throw new NotFoundException('Branch price override not found');
    }

    await this.prisma.branchPriceOverride.delete({
      where: {
        id: existing.id,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'DELETE_BRANCH_PRICE_OVERRIDE',
      entity: 'branch_price_override',
      metadata: {
        branchPriceOverrideId: existing.id,
        branchId,
        productId: product.id,
      },
    });

    return {
      message: 'Branch price override deleted successfully',
    };
  }

  private async getProductInBranch(branchId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        branchId,
      },
      select: {
        id: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found in current branch');
    }

    return product;
  }

  private async resolveVariant(productId: string, variantId?: string) {
    if (!variantId) {
      return null;
    }

    const variant = await this.prisma.productVariant.findFirst({
      where: {
        id: variantId,
        productId,
      },
      select: {
        id: true,
      },
    });

    if (!variant) {
      throw new BadRequestException('Variant not found for the given product');
    }

    return variant;
  }

  private async ensureUniqueOverride(
    branchId: string,
    productId: string,
    variantId?: string,
    ignoreId?: string,
  ) {
    const existing = await this.prisma.branchPriceOverride.findFirst({
      where: {
        branchId,
        productId,
        variantId: variantId ?? null,
        id: ignoreId ? { not: ignoreId } : undefined,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new BadRequestException('A branch price override already exists for this target');
    }
  }
}
