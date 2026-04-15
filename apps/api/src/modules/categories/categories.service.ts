import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { normalizeCategoryName } from './domain/category.rules';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(branchId: string, actorUserId: string, dto: CreateCategoryDto) {
    const name = normalizeCategoryName(dto.name);

    await this.ensureCategoryNameUnique(branchId, name);

    const category = await this.prisma.category.create({
      data: {
        branchId,
        name,
        description: dto.description,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive ?? true,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'CREATE_CATEGORY',
      entity: 'category',
      metadata: {
        categoryId: category.id,
        branchId,
      },
    });

    return category;
  }

  async findAll(branchId: string) {
    return this.prisma.category.findMany({
      where: {
        branchId,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findById(branchId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: {
        id,
        branchId,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(branchId: string, id: string, actorUserId: string, dto: UpdateCategoryDto) {
    const category = await this.findById(branchId, id);

    const updateData: {
      name?: string;
      description?: string;
      sortOrder?: number;
      isActive?: boolean;
    } = {};

    if (dto.name !== undefined) {
      updateData.name = normalizeCategoryName(dto.name);
    }

    if (dto.description !== undefined) {
      updateData.description = dto.description;
    }

    if (dto.sortOrder !== undefined) {
      updateData.sortOrder = dto.sortOrder;
    }

    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive;
    }

    if (Object.keys(updateData).length === 0) {
      return category;
    }

    if (updateData.name && updateData.name !== category.name) {
      await this.ensureCategoryNameUnique(branchId, updateData.name, category.id);
    }

    const updated = await this.prisma.category.update({
      where: {
        id: category.id,
      },
      data: updateData,
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'UPDATE_CATEGORY',
      entity: 'category',
      metadata: {
        categoryId: category.id,
        branchId,
        changes: updateData,
      },
    });

    return updated;
  }

  async remove(branchId: string, id: string, actorUserId: string) {
    const category = await this.findById(branchId, id);

    const productCount = await this.prisma.product.count({
      where: {
        categoryId: category.id,
        branchId,
      },
    });

    if (productCount > 0) {
      throw new BadRequestException('Cannot delete category that has products');
    }

    await this.prisma.category.delete({
      where: {
        id: category.id,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'DELETE_CATEGORY',
      entity: 'category',
      metadata: {
        categoryId: category.id,
        branchId,
      },
    });

    return {
      message: 'Category deleted successfully',
    };
  }

  private async ensureCategoryNameUnique(
    branchId: string,
    name: string,
    ignoreCategoryId?: string,
  ): Promise<void> {
    const existing = await this.prisma.category.findFirst({
      where: {
        branchId,
        name,
        id: ignoreCategoryId ? { not: ignoreCategoryId } : undefined,
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException('Category name already exists in this branch');
    }
  }
}
