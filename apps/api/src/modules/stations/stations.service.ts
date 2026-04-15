import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateProductStationRouteDto } from './dto/create-product-station-route.dto';
import { CreateStationDto } from './dto/create-station.dto';
import { UpdateProductStationRouteDto } from './dto/update-product-station-route.dto';
import { UpdateStationActiveStateDto } from './dto/update-station-active-state.dto';
import { UpdateStationDto } from './dto/update-station.dto';
import { normalizeStationCode, normalizeStationName } from './domain/station.rules';

@Injectable()
export class StationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(branchId: string, actorUserId: string, dto: CreateStationDto) {
    const name = normalizeStationName(dto.name);
    const code = normalizeStationCode(dto.code);

    await this.ensureStationNameUnique(branchId, name);
    await this.ensureStationCodeUnique(branchId, code);

    const station = await this.prisma.station.create({
      data: {
        branchId,
        name,
        code,
        stationType: dto.stationType,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive ?? true,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'CREATE_STATION',
      entity: 'station',
      metadata: {
        stationId: station.id,
        branchId,
      },
    });

    return station;
  }

  async findAll(branchId: string, options?: { includeInactive?: boolean }) {
    const includeInactive = options?.includeInactive ?? true;
    return this.prisma.station.findMany({
      where: {
        branchId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findById(branchId: string, stationId: string, options?: { requireActive?: boolean }) {
    const station = await this.prisma.station.findFirst({
      where: {
        id: stationId,
        branchId,
        ...(options?.requireActive ? { isActive: true } : {}),
      },
    });

    if (!station) {
      throw new NotFoundException('Station not found');
    }

    return station;
  }

  async update(branchId: string, stationId: string, actorUserId: string, dto: UpdateStationDto) {
    const station = await this.findById(branchId, stationId);

    const updateData: {
      name?: string;
      code?: string;
      stationType?: CreateStationDto['stationType'];
      sortOrder?: number;
    } = {};

    if (dto.name !== undefined) {
      updateData.name = normalizeStationName(dto.name);
    }

    if (dto.code !== undefined) {
      updateData.code = normalizeStationCode(dto.code);
    }

    if (dto.stationType !== undefined) {
      updateData.stationType = dto.stationType;
    }

    if (dto.sortOrder !== undefined) {
      updateData.sortOrder = dto.sortOrder;
    }

    if (Object.keys(updateData).length === 0) {
      return station;
    }

    if (updateData.name && updateData.name !== station.name) {
      await this.ensureStationNameUnique(branchId, updateData.name, station.id);
    }

    if (updateData.code && updateData.code !== station.code) {
      await this.ensureStationCodeUnique(branchId, updateData.code, station.id);
    }

    const updated = await this.prisma.station.update({
      where: { id: station.id },
      data: updateData,
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'UPDATE_STATION',
      entity: 'station',
      metadata: {
        stationId: station.id,
        branchId,
        changes: updateData,
      },
    });

    return updated;
  }

  async remove(branchId: string, stationId: string, actorUserId: string) {
    const station = await this.findById(branchId, stationId);

    const [routeCount, ticketCount, ticketItemCount] = await Promise.all([
      this.prisma.productStationRoute.count({
        where: {
          branchId,
          stationId: station.id,
        },
      }),
      this.prisma.productionTicket.count({
        where: {
          branchId,
          stationId: station.id,
        },
      }),
      this.prisma.productionTicketItem.count({
        where: {
          branchId,
          stationId: station.id,
        },
      }),
    ]);

    if (routeCount > 0 || ticketCount > 0 || ticketItemCount > 0) {
      throw new ConflictException('Cannot delete station that has active or historical production usage');
    }

    await this.prisma.station.delete({
      where: {
        id: station.id,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'DELETE_STATION',
      entity: 'station',
      metadata: {
        stationId: station.id,
        branchId,
      },
    });

    return {
      message: 'Station deleted successfully',
    };
  }

  async updateActiveState(
    branchId: string,
    stationId: string,
    actorUserId: string,
    dto: UpdateStationActiveStateDto,
  ) {
    const station = await this.findById(branchId, stationId);

    if (!dto.isActive) {
      const openTicketCount = await this.prisma.productionTicket.count({
        where: {
          branchId,
          stationId: station.id,
          status: {
            in: ['OPEN', 'IN_PROGRESS', 'READY'],
          },
        },
      });

      if (openTicketCount > 0) {
        throw new ConflictException('Cannot deactivate station with active production tickets');
      }
    }

    const updated = await this.prisma.station.update({
      where: {
        id: station.id,
      },
      data: {
        isActive: dto.isActive,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'UPDATE_STATION_ACTIVE_STATE',
      entity: 'station',
      metadata: {
        stationId: station.id,
        branchId,
        isActive: dto.isActive,
      },
    });

    return updated;
  }

  async createProductRoute(
    branchId: string,
    productId: string,
    actorUserId: string,
    dto: CreateProductStationRouteDto,
  ) {
    await this.ensureProductInBranch(branchId, productId);
    const station = await this.findById(branchId, dto.stationId);

    const existing = await this.prisma.productStationRoute.findFirst({
      where: {
        branchId,
        productId,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new BadRequestException('Product already has a station route');
    }

    const route = await this.prisma.productStationRoute.create({
      data: {
        branchId,
        productId,
        stationId: station.id,
      },
      include: {
        station: true,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'CREATE_PRODUCT_STATION_ROUTE',
      entity: 'product_station_route',
      metadata: {
        productStationRouteId: route.id,
        productId,
        stationId: station.id,
        branchId,
      },
    });

    return route;
  }

  async getProductRoute(branchId: string, productId: string) {
    await this.ensureProductInBranch(branchId, productId);

    const route = await this.prisma.productStationRoute.findFirst({
      where: {
        branchId,
        productId,
      },
      include: {
        station: true,
      },
    });

    if (!route) {
      throw new NotFoundException('Product station route not found');
    }

    return route;
  }

  async updateProductRoute(
    branchId: string,
    productId: string,
    actorUserId: string,
    dto: UpdateProductStationRouteDto,
  ) {
    const route = await this.getProductRoute(branchId, productId);
    const station = await this.findById(branchId, dto.stationId);

    if (route.stationId === station.id) {
      return route;
    }

    const updated = await this.prisma.productStationRoute.update({
      where: {
        id: route.id,
      },
      data: {
        stationId: station.id,
      },
      include: {
        station: true,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'UPDATE_PRODUCT_STATION_ROUTE',
      entity: 'product_station_route',
      metadata: {
        productStationRouteId: route.id,
        productId,
        stationId: station.id,
        previousStationId: route.stationId,
        branchId,
      },
    });

    return updated;
  }

  async deleteProductRoute(branchId: string, productId: string, actorUserId: string) {
    const route = await this.getProductRoute(branchId, productId);

    await this.prisma.productStationRoute.delete({
      where: {
        id: route.id,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'DELETE_PRODUCT_STATION_ROUTE',
      entity: 'product_station_route',
      metadata: {
        productStationRouteId: route.id,
        productId,
        stationId: route.stationId,
        branchId,
      },
    });

    return {
      message: 'Product station route deleted successfully',
    };
  }

  private async ensureProductInBranch(branchId: string, productId: string) {
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

  private async ensureStationNameUnique(branchId: string, name: string, ignoreStationId?: string) {
    const existing = await this.prisma.station.findFirst({
      where: {
        branchId,
        name,
        id: ignoreStationId ? { not: ignoreStationId } : undefined,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new BadRequestException('Station name already exists in this branch');
    }
  }

  private async ensureStationCodeUnique(branchId: string, code: string, ignoreStationId?: string) {
    const existing = await this.prisma.station.findFirst({
      where: {
        branchId,
        code,
        id: ignoreStationId ? { not: ignoreStationId } : undefined,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new BadRequestException('Station code already exists in this branch');
    }
  }
}
