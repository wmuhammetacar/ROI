import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateProductModifierGroupLinkDto } from './dto/create-product-modifier-group-link.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { UpdateProductActiveStateDto } from './dto/update-product-active-state.dto';
import { UpdateProductAvailabilityDto } from './dto/update-product-availability.dto';
import { UpdateProductModifierGroupLinkDto } from './dto/update-product-modifier-group-link.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import {
  assertProductTypeSupportsVariants,
  normalizeProductName,
  normalizeVariantName,
} from './domain/product.rules';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(branchId: string, actorUserId: string, dto: CreateProductDto) {
    await this.ensureCategoryInBranch(branchId, dto.categoryId);
    const name = normalizeProductName(dto.name);

    await this.ensureProductNameUnique(branchId, name);

    const product = await this.prisma.product.create({
      data: {
        branchId,
        categoryId: dto.categoryId,
        name,
        description: dto.description,
        allergenTags: this.normalizeAllergenTags(dto.allergenTags),
        sku: dto.sku,
        imageUrl: dto.imageUrl,
        basePrice: new Prisma.Decimal(dto.basePrice),
        sortOrder: dto.sortOrder,
        isActive: dto.isActive ?? true,
        isAvailable: dto.isAvailable ?? true,
        productType: dto.productType,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'CREATE_PRODUCT',
      entity: 'product',
      metadata: {
        productId: product.id,
        branchId,
      },
    });

    return this.findById(branchId, product.id);
  }

  async findAll(branchId: string) {
    return this.prisma.product.findMany({
      where: {
        branchId,
      },
      include: {
        category: true,
        stationRoute: {
          include: {
            station: {
              select: {
                id: true,
                name: true,
                code: true,
                isActive: true,
              },
            },
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findById(branchId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        branchId,
      },
      include: {
        category: true,
        variants: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
        modifierGroupLinks: {
          include: {
            modifierGroup: {
              include: {
                options: {
                  orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                },
              },
            },
          },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
        priceOverrides: {
          include: {
            variant: true,
          },
          orderBy: [{ variantId: 'asc' }, { createdAt: 'asc' }],
        },
        stationRoute: {
          include: {
            station: {
              select: {
                id: true,
                name: true,
                code: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async update(branchId: string, productId: string, actorUserId: string, dto: UpdateProductDto) {
    const product = await this.findById(branchId, productId);

    const updateData: Prisma.ProductUpdateInput = {};
    let nextName: string | undefined;

    if (dto.categoryId !== undefined) {
      await this.ensureCategoryInBranch(branchId, dto.categoryId);
      updateData.category = {
        connect: {
          id: dto.categoryId,
        },
      };
    }

    if (dto.name !== undefined) {
      nextName = normalizeProductName(dto.name);
      updateData.name = nextName;
    }

    if (dto.description !== undefined) {
      updateData.description = dto.description;
    }

    if (dto.allergenTags !== undefined) {
      updateData.allergenTags = this.normalizeAllergenTags(dto.allergenTags);
    }

    if (dto.sku !== undefined) {
      updateData.sku = dto.sku;
    }

    if (dto.imageUrl !== undefined) {
      updateData.imageUrl = dto.imageUrl;
    }

    if (dto.basePrice !== undefined) {
      updateData.basePrice = new Prisma.Decimal(dto.basePrice);
    }

    if (dto.sortOrder !== undefined) {
      updateData.sortOrder = dto.sortOrder;
    }

    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive;
    }

    if (dto.isAvailable !== undefined) {
      updateData.isAvailable = dto.isAvailable;
    }

    if (dto.productType !== undefined) {
      if (dto.productType === ProductType.SIMPLE) {
        const variantCount = await this.prisma.productVariant.count({
          where: {
            productId: product.id,
          },
        });

        if (variantCount > 0) {
          throw new BadRequestException('Cannot switch productType to SIMPLE while variants exist');
        }
      }

      updateData.productType = dto.productType;
    }

    if (nextName && nextName !== product.name) {
      await this.ensureProductNameUnique(branchId, nextName, product.id);
    }

    const updated = await this.prisma.product.update({
      where: {
        id: product.id,
      },
      data: updateData,
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'UPDATE_PRODUCT',
      entity: 'product',
      metadata: {
        productId: product.id,
        branchId,
      },
    });

    return this.findById(branchId, updated.id);
  }

  async remove(branchId: string, productId: string, actorUserId: string) {
    const product = await this.findById(branchId, productId);

    const variantCount = await this.prisma.productVariant.count({
      where: {
        productId: product.id,
      },
    });

    if (variantCount > 0) {
      throw new BadRequestException('Cannot delete product that has variants');
    }

    const linkCount = await this.prisma.productModifierGroupLink.count({
      where: {
        productId: product.id,
      },
    });

    if (linkCount > 0) {
      throw new BadRequestException('Cannot delete product that has linked modifier groups');
    }

    const priceOverrideCount = await this.prisma.branchPriceOverride.count({
      where: {
        productId: product.id,
        branchId,
      },
    });

    if (priceOverrideCount > 0) {
      throw new BadRequestException('Cannot delete product that has branch pricing overrides');
    }

    await this.prisma.product.delete({
      where: {
        id: product.id,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'DELETE_PRODUCT',
      entity: 'product',
      metadata: {
        productId: product.id,
        branchId,
      },
    });

    return {
      message: 'Product deleted successfully',
    };
  }

  async updateAvailability(
    branchId: string,
    productId: string,
    actorUserId: string,
    dto: UpdateProductAvailabilityDto,
  ) {
    const product = await this.findById(branchId, productId);

    const updated = await this.prisma.product.update({
      where: {
        id: product.id,
      },
      data: {
        isAvailable: dto.isAvailable,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'UPDATE_PRODUCT_AVAILABILITY',
      entity: 'product',
      metadata: {
        productId: product.id,
        branchId,
        isAvailable: dto.isAvailable,
      },
    });

    return updated;
  }

  async updateActiveState(
    branchId: string,
    productId: string,
    actorUserId: string,
    dto: UpdateProductActiveStateDto,
  ) {
    const product = await this.findById(branchId, productId);

    const updated = await this.prisma.product.update({
      where: {
        id: product.id,
      },
      data: {
        isActive: dto.isActive,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'UPDATE_PRODUCT_ACTIVE_STATE',
      entity: 'product',
      metadata: {
        productId: product.id,
        branchId,
        isActive: dto.isActive,
      },
    });

    return updated;
  }

  async createVariant(
    branchId: string,
    productId: string,
    actorUserId: string,
    dto: CreateProductVariantDto,
  ) {
    const product = await this.findById(branchId, productId);
    assertProductTypeSupportsVariants(product.productType);

    const name = normalizeVariantName(dto.name);
    await this.ensureVariantNameUnique(product.id, name);

    const variant = await this.prisma.productVariant.create({
      data: {
        productId: product.id,
        name,
        sku: dto.sku,
        priceDelta: new Prisma.Decimal(dto.priceDelta),
        sortOrder: dto.sortOrder,
        isActive: dto.isActive ?? true,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'CREATE_PRODUCT_VARIANT',
      entity: 'product_variant',
      metadata: {
        productVariantId: variant.id,
        productId: product.id,
        branchId,
      },
    });

    return variant;
  }

  async findVariants(branchId: string, productId: string) {
    const product = await this.findById(branchId, productId);

    return this.prisma.productVariant.findMany({
      where: {
        productId: product.id,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async updateVariant(
    branchId: string,
    productId: string,
    variantId: string,
    actorUserId: string,
    dto: UpdateProductVariantDto,
  ) {
    const product = await this.findById(branchId, productId);

    const variant = await this.prisma.productVariant.findFirst({
      where: {
        id: variantId,
        productId: product.id,
      },
    });

    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }

    const updateData: Prisma.ProductVariantUpdateInput = {};
    let nextName: string | undefined;

    if (dto.name !== undefined) {
      nextName = normalizeVariantName(dto.name);
      updateData.name = nextName;
    }

    if (dto.sku !== undefined) {
      updateData.sku = dto.sku;
    }

    if (dto.priceDelta !== undefined) {
      updateData.priceDelta = new Prisma.Decimal(dto.priceDelta);
    }

    if (dto.sortOrder !== undefined) {
      updateData.sortOrder = dto.sortOrder;
    }

    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive;
    }

    if (nextName && nextName !== variant.name) {
      await this.ensureVariantNameUnique(product.id, nextName, variant.id);
    }

    const updated = await this.prisma.productVariant.update({
      where: {
        id: variant.id,
      },
      data: updateData,
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'UPDATE_PRODUCT_VARIANT',
      entity: 'product_variant',
      metadata: {
        productVariantId: variant.id,
        productId: product.id,
        branchId,
      },
    });

    return updated;
  }

  async removeVariant(branchId: string, productId: string, variantId: string, actorUserId: string) {
    const product = await this.findById(branchId, productId);

    const variant = await this.prisma.productVariant.findFirst({
      where: {
        id: variantId,
        productId: product.id,
      },
    });

    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }

    const priceOverrideCount = await this.prisma.branchPriceOverride.count({
      where: {
        productId: product.id,
        branchId,
        variantId: variant.id,
      },
    });

    if (priceOverrideCount > 0) {
      throw new ConflictException('Cannot delete variant with active branch pricing overrides');
    }

    await this.prisma.productVariant.delete({
      where: {
        id: variant.id,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'DELETE_PRODUCT_VARIANT',
      entity: 'product_variant',
      metadata: {
        productVariantId: variant.id,
        productId: product.id,
        branchId,
      },
    });

    return {
      message: 'Product variant deleted successfully',
    };
  }

  async createModifierGroupLink(
    branchId: string,
    productId: string,
    actorUserId: string,
    dto: CreateProductModifierGroupLinkDto,
  ) {
    const product = await this.findById(branchId, productId);
    const modifierGroup = await this.prisma.modifierGroup.findFirst({
      where: {
        id: dto.modifierGroupId,
        branchId,
      },
      select: { id: true },
    });

    if (!modifierGroup) {
      throw new BadRequestException('Modifier group not found in current branch');
    }

    const existingLink = await this.prisma.productModifierGroupLink.findFirst({
      where: {
        productId: product.id,
        modifierGroupId: modifierGroup.id,
      },
      select: { id: true },
    });

    if (existingLink) {
      throw new BadRequestException('Modifier group already linked to this product');
    }

    const link = await this.prisma.productModifierGroupLink.create({
      data: {
        productId: product.id,
        modifierGroupId: modifierGroup.id,
        isRequired: dto.isRequired,
        sortOrder: dto.sortOrder,
      },
      include: {
        modifierGroup: {
          include: {
            options: {
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'CREATE_PRODUCT_MODIFIER_GROUP_LINK',
      entity: 'product_modifier_group_link',
      metadata: {
        productModifierGroupLinkId: link.id,
        productId: product.id,
        modifierGroupId: modifierGroup.id,
        branchId,
      },
    });

    return link;
  }

  async findModifierGroupLinks(branchId: string, productId: string) {
    const product = await this.findById(branchId, productId);

    return this.prisma.productModifierGroupLink.findMany({
      where: {
        productId: product.id,
      },
      include: {
        modifierGroup: {
          include: {
            options: {
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async updateModifierGroupLink(
    branchId: string,
    productId: string,
    linkId: string,
    actorUserId: string,
    dto: UpdateProductModifierGroupLinkDto,
  ) {
    const product = await this.findById(branchId, productId);

    const link = await this.prisma.productModifierGroupLink.findFirst({
      where: {
        id: linkId,
        productId: product.id,
      },
    });

    if (!link) {
      throw new NotFoundException('Product modifier group link not found');
    }

    const updated = await this.prisma.productModifierGroupLink.update({
      where: {
        id: link.id,
      },
      data: {
        isRequired: dto.isRequired !== undefined ? dto.isRequired : link.isRequired,
        sortOrder: dto.sortOrder !== undefined ? dto.sortOrder : link.sortOrder,
      },
      include: {
        modifierGroup: {
          include: {
            options: {
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'UPDATE_PRODUCT_MODIFIER_GROUP_LINK',
      entity: 'product_modifier_group_link',
      metadata: {
        productModifierGroupLinkId: link.id,
        productId: product.id,
        branchId,
      },
    });

    return updated;
  }

  async removeModifierGroupLink(
    branchId: string,
    productId: string,
    linkId: string,
    actorUserId: string,
  ) {
    const product = await this.findById(branchId, productId);

    const link = await this.prisma.productModifierGroupLink.findFirst({
      where: {
        id: linkId,
        productId: product.id,
      },
    });

    if (!link) {
      throw new NotFoundException('Product modifier group link not found');
    }

    await this.prisma.productModifierGroupLink.delete({
      where: {
        id: link.id,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'DELETE_PRODUCT_MODIFIER_GROUP_LINK',
      entity: 'product_modifier_group_link',
      metadata: {
        productModifierGroupLinkId: link.id,
        productId: product.id,
        branchId,
      },
    });

    return {
      message: 'Product modifier group link deleted successfully',
    };
  }

  private async ensureCategoryInBranch(branchId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        branchId,
      },
      select: { id: true },
    });

    if (!category) {
      throw new BadRequestException('Category not found in current branch');
    }
  }

  private async ensureProductNameUnique(branchId: string, name: string, ignoreProductId?: string) {
    const existing = await this.prisma.product.findFirst({
      where: {
        branchId,
        name,
        id: ignoreProductId ? { not: ignoreProductId } : undefined,
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException('Product name already exists in this branch');
    }
  }

  private async ensureVariantNameUnique(productId: string, name: string, ignoreVariantId?: string) {
    const existing = await this.prisma.productVariant.findFirst({
      where: {
        productId,
        name,
        id: ignoreVariantId ? { not: ignoreVariantId } : undefined,
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException('Variant name already exists for this product');
    }
  }

  private normalizeAllergenTags(allergenTags: string[] | undefined): string[] {
    if (!allergenTags || allergenTags.length === 0) {
      return [];
    }

    const unique = new Set<string>();
    for (const tag of allergenTags) {
      const normalized = tag.trim();
      if (!normalized) {
        continue;
      }
      unique.add(normalized);
    }
    return Array.from(unique);
  }
}
