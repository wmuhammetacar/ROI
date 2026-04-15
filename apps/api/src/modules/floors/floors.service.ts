import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateFloorDto } from './dto/create-floor.dto';
import { UpdateFloorDto } from './dto/update-floor.dto';
import { normalizeFloorName } from './domain/floor.rules';

@Injectable()
export class FloorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(branchId: string, actorUserId: string, dto: CreateFloorDto) {
    const name = normalizeFloorName(dto.name);

    const existing = await this.prisma.floor.findFirst({
      where: {
        branchId,
        name,
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException('Floor name already exists in this branch');
    }

    const floor = await this.prisma.floor.create({
      data: {
        branchId,
        name,
        sortOrder: dto.sortOrder,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'CREATE_FLOOR',
      entity: 'floor',
      metadata: {
        floorId: floor.id,
        branchId,
      },
    });

    return floor;
  }

  async findAll(branchId: string) {
    return this.prisma.floor.findMany({
      where: { branchId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findById(branchId: string, id: string) {
    const floor = await this.prisma.floor.findFirst({
      where: {
        id,
        branchId,
      },
    });

    if (!floor) {
      throw new NotFoundException('Floor not found');
    }

    return floor;
  }

  async update(branchId: string, id: string, actorUserId: string, dto: UpdateFloorDto) {
    const floor = await this.findById(branchId, id);

    const updateData: { name?: string; sortOrder?: number } = {};

    if (dto.name !== undefined) {
      updateData.name = normalizeFloorName(dto.name);
    }

    if (dto.sortOrder !== undefined) {
      updateData.sortOrder = dto.sortOrder;
    }

    if (Object.keys(updateData).length === 0) {
      return floor;
    }

    if (updateData.name && updateData.name !== floor.name) {
      const duplicate = await this.prisma.floor.findFirst({
        where: {
          branchId,
          name: updateData.name,
          id: { not: floor.id },
        },
        select: { id: true },
      });

      if (duplicate) {
        throw new BadRequestException('Floor name already exists in this branch');
      }
    }

    const updated = await this.prisma.floor.update({
      where: { id: floor.id },
      data: updateData,
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'UPDATE_FLOOR',
      entity: 'floor',
      metadata: {
        floorId: floor.id,
        branchId,
        changes: updateData,
      },
    });

    return updated;
  }

  async remove(branchId: string, id: string, actorUserId: string) {
    const floor = await this.findById(branchId, id);

    const tableCount = await this.prisma.table.count({
      where: {
        floorId: floor.id,
        branchId,
      },
    });

    if (tableCount > 0) {
      throw new BadRequestException('Cannot delete a floor with tables');
    }

    await this.prisma.floor.delete({ where: { id: floor.id } });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'DELETE_FLOOR',
      entity: 'floor',
      metadata: {
        floorId: floor.id,
        branchId,
      },
    });

    return {
      message: 'Floor deleted successfully',
    };
  }
}
