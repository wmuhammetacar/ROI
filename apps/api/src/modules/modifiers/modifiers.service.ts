import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ModifierSelectionType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateModifierGroupDto } from './dto/create-modifier-group.dto';
import { CreateModifierOptionDto } from './dto/create-modifier-option.dto';
import { UpdateModifierGroupDto } from './dto/update-modifier-group.dto';
import { UpdateModifierOptionDto } from './dto/update-modifier-option.dto';
import {
  normalizeModifierGroupName,
  normalizeModifierOptionName,
  validateSelectionConfig,
} from './domain/modifier.rules';

@Injectable()
export class ModifiersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createGroup(branchId: string, actorUserId: string, dto: CreateModifierGroupDto) {
    const name = normalizeModifierGroupName(dto.name);
    validateSelectionConfig(dto.selectionType, dto.minSelect, dto.maxSelect);

    await this.ensureGroupNameUnique(branchId, name);

    const group = await this.prisma.modifierGroup.create({
      data: {
        branchId,
        name,
        description: dto.description,
        selectionType: dto.selectionType,
        minSelect: dto.minSelect,
        maxSelect: dto.maxSelect,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive ?? true,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'CREATE_MODIFIER_GROUP',
      entity: 'modifier_group',
      metadata: {
        modifierGroupId: group.id,
        branchId,
      },
    });

    return group;
  }

  async findAllGroups(branchId: string) {
    return this.prisma.modifierGroup.findMany({
      where: { branchId },
      include: {
        options: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findGroupById(branchId: string, id: string) {
    const group = await this.prisma.modifierGroup.findFirst({
      where: {
        id,
        branchId,
      },
      include: {
        options: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Modifier group not found');
    }

    return group;
  }

  async updateGroup(
    branchId: string,
    id: string,
    actorUserId: string,
    dto: UpdateModifierGroupDto,
  ) {
    const group = await this.findGroupById(branchId, id);

    const selectionType = dto.selectionType ?? group.selectionType;
    const minSelect = dto.minSelect ?? group.minSelect;
    const maxSelect = dto.maxSelect ?? group.maxSelect;

    validateSelectionConfig(selectionType, minSelect, maxSelect);

    const updateData: Prisma.ModifierGroupUpdateInput = {};
    let nextName: string | undefined;

    if (dto.name !== undefined) {
      nextName = normalizeModifierGroupName(dto.name);
      updateData.name = nextName;
    }

    if (dto.description !== undefined) {
      updateData.description = dto.description;
    }

    if (dto.selectionType !== undefined) {
      updateData.selectionType = dto.selectionType;
    }

    if (dto.minSelect !== undefined) {
      updateData.minSelect = dto.minSelect;
    }

    if (dto.maxSelect !== undefined) {
      updateData.maxSelect = dto.maxSelect;
    }

    if (dto.sortOrder !== undefined) {
      updateData.sortOrder = dto.sortOrder;
    }

    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive;
    }

    if (nextName && nextName !== group.name) {
      await this.ensureGroupNameUnique(branchId, nextName, group.id);
    }

    const updated = await this.prisma.modifierGroup.update({
      where: { id: group.id },
      data: updateData,
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'UPDATE_MODIFIER_GROUP',
      entity: 'modifier_group',
      metadata: {
        modifierGroupId: group.id,
        branchId,
      },
    });

    return updated;
  }

  async removeGroup(branchId: string, id: string, actorUserId: string) {
    const group = await this.findGroupById(branchId, id);

    const linkCount = await this.prisma.productModifierGroupLink.count({
      where: {
        modifierGroupId: group.id,
      },
    });

    if (linkCount > 0) {
      throw new BadRequestException('Cannot delete modifier group because it is linked to products');
    }

    const optionCount = await this.prisma.modifierOption.count({
      where: {
        modifierGroupId: group.id,
      },
    });

    if (optionCount > 0) {
      throw new BadRequestException('Cannot delete modifier group with existing options');
    }

    await this.prisma.modifierGroup.delete({
      where: {
        id: group.id,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'DELETE_MODIFIER_GROUP',
      entity: 'modifier_group',
      metadata: {
        modifierGroupId: group.id,
        branchId,
      },
    });

    return {
      message: 'Modifier group deleted successfully',
    };
  }

  async createOption(
    branchId: string,
    groupId: string,
    actorUserId: string,
    dto: CreateModifierOptionDto,
  ) {
    const group = await this.findGroupById(branchId, groupId);
    const name = normalizeModifierOptionName(dto.name);

    await this.ensureOptionNameUnique(group.id, name);

    const option = await this.prisma.modifierOption.create({
      data: {
        modifierGroupId: group.id,
        name,
        priceDelta: new Prisma.Decimal(dto.priceDelta),
        sortOrder: dto.sortOrder,
        isActive: dto.isActive ?? true,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'CREATE_MODIFIER_OPTION',
      entity: 'modifier_option',
      metadata: {
        modifierOptionId: option.id,
        modifierGroupId: group.id,
        branchId,
      },
    });

    return option;
  }

  async findOptions(branchId: string, groupId: string) {
    const group = await this.findGroupById(branchId, groupId);

    return this.prisma.modifierOption.findMany({
      where: {
        modifierGroupId: group.id,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async updateOption(
    branchId: string,
    groupId: string,
    optionId: string,
    actorUserId: string,
    dto: UpdateModifierOptionDto,
  ) {
    const group = await this.findGroupById(branchId, groupId);

    const option = await this.prisma.modifierOption.findFirst({
      where: {
        id: optionId,
        modifierGroupId: group.id,
      },
    });

    if (!option) {
      throw new NotFoundException('Modifier option not found');
    }

    const updateData: Prisma.ModifierOptionUpdateInput = {};
    let nextName: string | undefined;

    if (dto.name !== undefined) {
      nextName = normalizeModifierOptionName(dto.name);
      updateData.name = nextName;
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

    if (nextName && nextName !== option.name) {
      await this.ensureOptionNameUnique(group.id, nextName, option.id);
    }

    const updated = await this.prisma.modifierOption.update({
      where: {
        id: option.id,
      },
      data: updateData,
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'UPDATE_MODIFIER_OPTION',
      entity: 'modifier_option',
      metadata: {
        modifierOptionId: option.id,
        modifierGroupId: group.id,
        branchId,
      },
    });

    return updated;
  }

  async removeOption(branchId: string, groupId: string, optionId: string, actorUserId: string) {
    const group = await this.findGroupById(branchId, groupId);

    const option = await this.prisma.modifierOption.findFirst({
      where: {
        id: optionId,
        modifierGroupId: group.id,
      },
    });

    if (!option) {
      throw new NotFoundException('Modifier option not found');
    }

    if (group.isActive) {
      throw new ConflictException(
        'Cannot delete modifier option while parent modifier group is active',
      );
    }

    await this.prisma.modifierOption.delete({
      where: {
        id: option.id,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'DELETE_MODIFIER_OPTION',
      entity: 'modifier_option',
      metadata: {
        modifierOptionId: option.id,
        modifierGroupId: group.id,
        branchId,
      },
    });

    return {
      message: 'Modifier option deleted successfully',
    };
  }

  private async ensureGroupNameUnique(
    branchId: string,
    name: string,
    ignoreGroupId?: string,
  ): Promise<void> {
    const existing = await this.prisma.modifierGroup.findFirst({
      where: {
        branchId,
        name,
        id: ignoreGroupId ? { not: ignoreGroupId } : undefined,
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException('Modifier group name already exists in this branch');
    }
  }

  private async ensureOptionNameUnique(
    modifierGroupId: string,
    name: string,
    ignoreOptionId?: string,
  ): Promise<void> {
    const existing = await this.prisma.modifierOption.findFirst({
      where: {
        modifierGroupId,
        name,
        id: ignoreOptionId ? { not: ignoreOptionId } : undefined,
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException('Modifier option name already exists in this group');
    }
  }
}
