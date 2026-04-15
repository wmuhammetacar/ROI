import { Injectable } from '@nestjs/common';
import { GetPosProductsDto } from './dto/get-pos-products.dto';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async getPosProducts(branchId: string, query: GetPosProductsDto) {
    const includeInactive = query.includeInactive === 'true';
    const includeUnavailable = query.includeUnavailable === 'true';

    const categories = await this.prisma.category.findMany({
      where: {
        branchId,
        isActive: includeInactive ? undefined : true,
        products: {
          some: {
            branchId,
            isActive: includeInactive ? undefined : true,
            isAvailable: includeUnavailable ? undefined : true,
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        products: {
          where: {
            branchId,
            isActive: includeInactive ? undefined : true,
            isAvailable: includeUnavailable ? undefined : true,
          },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            variants: {
              where: {
                isActive: includeInactive ? undefined : true,
              },
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            },
            modifierGroupLinks: {
              where: {
                modifierGroup: {
                  isActive: includeInactive ? undefined : true,
                },
              },
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
              include: {
                modifierGroup: {
                  include: {
                    options: {
                      where: {
                        isActive: includeInactive ? undefined : true,
                      },
                      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                    },
                  },
                },
              },
            },
            priceOverrides: {
              where: {
                branchId,
              },
              orderBy: [{ variantId: 'asc' }, { createdAt: 'asc' }],
              include: {
                variant: true,
              },
            },
          },
        },
      },
    });

    return {
      branchId,
      filters: {
        includeInactive,
        includeUnavailable,
      },
      categories,
    };
  }
}
