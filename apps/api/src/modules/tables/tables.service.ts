import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TableStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { REALTIME_EVENTS } from '../realtime/realtime-events.constants';
import { RealtimeEventsService } from '../realtime/realtime-events.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableStatusDto } from './dto/update-table-status.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { ensureManualStatusChangeAllowed, normalizeTableName } from './domain/table.rules';

@Injectable()
export class TablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly realtimeEvents: RealtimeEventsService,
  ) {}

  async create(branchId: string, actorUserId: string, dto: CreateTableDto) {
    await this.ensureFloorInBranch(dto.floorId, branchId);

    const name = normalizeTableName(dto.name);
    await this.ensureNameIsUnique(branchId, name);

    const table = await this.prisma.table.create({
      data: {
        branchId,
        floorId: dto.floorId,
        name,
        capacity: dto.capacity,
        status: dto.status ?? TableStatus.AVAILABLE,
      },
      include: {
        floor: true,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'CREATE_TABLE',
      entity: 'table',
      metadata: {
        tableId: table.id,
        branchId,
        floorId: table.floorId,
      },
    });

    this.realtimeEvents.emitToBranch(branchId, REALTIME_EVENTS.TABLE_UPDATED, {
      tableId: table.id,
      status: table.status,
      floorId: table.floorId,
      reason: 'table_created',
    });

    return table;
  }

  async findAll(branchId: string) {
    return this.prisma.table.findMany({
      where: { branchId },
      include: {
        floor: true,
      },
      orderBy: [{ floor: { sortOrder: 'asc' } }, { name: 'asc' }],
    });
  }

  async findById(branchId: string, id: string) {
    const table = await this.prisma.table.findFirst({
      where: {
        id,
        branchId,
      },
      include: {
        floor: true,
      },
    });

    if (!table) {
      throw new NotFoundException('Table not found');
    }

    return table;
  }

  async update(branchId: string, id: string, actorUserId: string, dto: UpdateTableDto) {
    const table = await this.findById(branchId, id);

    const updateData: {
      floorId?: string;
      name?: string;
      capacity?: number;
    } = {};

    if (dto.floorId !== undefined) {
      await this.ensureFloorInBranch(dto.floorId, branchId);
      updateData.floorId = dto.floorId;
    }

    if (dto.name !== undefined) {
      updateData.name = normalizeTableName(dto.name);
    }

    if (dto.capacity !== undefined) {
      updateData.capacity = dto.capacity;
    }

    if (Object.keys(updateData).length === 0) {
      return table;
    }

    if (updateData.name && updateData.name !== table.name) {
      await this.ensureNameIsUnique(branchId, updateData.name, table.id);
    }

    const updated = await this.prisma.table.update({
      where: {
        id: table.id,
      },
      data: updateData,
      include: {
        floor: true,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'UPDATE_TABLE',
      entity: 'table',
      metadata: {
        tableId: table.id,
        branchId,
        changes: updateData,
      },
    });

    this.realtimeEvents.emitToBranch(branchId, REALTIME_EVENTS.TABLE_UPDATED, {
      tableId: updated.id,
      status: updated.status,
      floorId: updated.floorId,
      reason: 'table_updated',
    });

    return updated;
  }

  async updateStatus(
    branchId: string,
    id: string,
    actorUserId: string,
    dto: UpdateTableStatusDto,
  ) {
    const table = await this.findById(branchId, id);

    const openSessionCount = await this.prisma.tableSession.count({
      where: {
        branchId,
        tableId: table.id,
        status: 'OPEN',
      },
    });

    ensureManualStatusChangeAllowed(openSessionCount, dto.status);

    const updated = await this.prisma.table.update({
      where: {
        id: table.id,
      },
      data: {
        status: dto.status,
      },
      include: {
        floor: true,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'UPDATE_TABLE_STATUS',
      entity: 'table',
      metadata: {
        tableId: table.id,
        branchId,
        previousStatus: table.status,
        nextStatus: dto.status,
      },
    });

    this.realtimeEvents.emitToBranch(branchId, REALTIME_EVENTS.TABLE_UPDATED, {
      tableId: updated.id,
      status: updated.status,
      floorId: updated.floorId,
      reason: 'table_status_changed',
    });

    return updated;
  }

  async remove(branchId: string, id: string, actorUserId: string) {
    const table = await this.findById(branchId, id);

    const openSessionCount = await this.prisma.tableSession.count({
      where: {
        branchId,
        tableId: table.id,
        status: 'OPEN',
      },
    });

    if (openSessionCount > 0) {
      throw new ConflictException('Cannot delete table with an open session');
    }

    const historicalSessionCount = await this.prisma.tableSession.count({
      where: {
        branchId,
        tableId: table.id,
      },
    });

    if (historicalSessionCount > 0) {
      throw new ConflictException('Cannot delete table with session history');
    }

    await this.prisma.table.delete({ where: { id: table.id } });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'DELETE_TABLE',
      entity: 'table',
      metadata: {
        tableId: table.id,
        branchId,
      },
    });

    return {
      message: 'Table deleted successfully',
    };
  }

  private async ensureFloorInBranch(floorId: string, branchId: string): Promise<void> {
    const floor = await this.prisma.floor.findFirst({
      where: {
        id: floorId,
        branchId,
      },
      select: { id: true },
    });

    if (!floor) {
      throw new BadRequestException('Floor not found in current branch');
    }
  }

  private async ensureNameIsUnique(branchId: string, name: string, ignoreTableId?: string): Promise<void> {
    const existing = await this.prisma.table.findFirst({
      where: {
        branchId,
        name,
        id: ignoreTableId ? { not: ignoreTableId } : undefined,
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException('Table name already exists in this branch');
    }
  }
}
