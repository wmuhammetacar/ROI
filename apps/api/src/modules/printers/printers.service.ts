import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePrinterDto } from './dto/create-printer.dto';
import { ListPrintersDto } from './dto/list-printers.dto';
import { PreviewPrinterRouteDto } from './dto/preview-printer-route.dto';
import { UpdatePrinterDto } from './dto/update-printer.dto';

@Injectable()
export class PrintersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(branchId: string, query: ListPrintersDto) {
    return this.prisma.printer.findMany({
      where: {
        branchId,
        printerRole: query.printerRole,
        stationId: query.stationId,
      },
      include: {
        station: { select: { id: true, name: true, code: true } },
        fallbackPrinter: { select: { id: true, name: true, isActive: true } },
      },
      orderBy: [{ priority: 'asc' }, { name: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(branchId: string, actorUserId: string, dto: CreatePrinterDto) {
    await this.validateRelations(branchId, dto.stationId, dto.fallbackPrinterId);

    const printer = await this.prisma.printer.create({
      data: {
        branchId,
        name: dto.name.trim(),
        printerRole: dto.printerRole,
        type: dto.type,
        ipAddress: dto.ipAddress?.trim() || null,
        stationId: dto.stationId ?? null,
        fallbackPrinterId: dto.fallbackPrinterId ?? null,
        copyCount: dto.copyCount ?? 1,
        priority: dto.priority ?? 100,
        isActive: dto.isActive ?? true,
      },
      include: {
        station: { select: { id: true, name: true, code: true } },
        fallbackPrinter: { select: { id: true, name: true, isActive: true } },
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'CREATE_PRINTER',
      entity: 'printer',
      metadata: { printerId: printer.id, branchId },
    });

    return printer;
  }

  async update(branchId: string, id: string, actorUserId: string, dto: UpdatePrinterDto) {
    const existing = await this.prisma.printer.findFirst({ where: { id, branchId } });
    if (!existing) {
      throw new NotFoundException('Printer not found');
    }

    const stationId = dto.stationId !== undefined ? dto.stationId ?? null : existing.stationId;
    const fallbackPrinterId =
      dto.fallbackPrinterId !== undefined ? dto.fallbackPrinterId ?? null : existing.fallbackPrinterId;

    await this.validateRelations(branchId, stationId ?? undefined, fallbackPrinterId ?? undefined, id);

    const updated = await this.prisma.printer.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        printerRole: dto.printerRole,
        type: dto.type,
        ipAddress: dto.ipAddress?.trim() || null,
        stationId,
        fallbackPrinterId,
        copyCount: dto.copyCount,
        priority: dto.priority,
        isActive: dto.isActive,
      },
      include: {
        station: { select: { id: true, name: true, code: true } },
        fallbackPrinter: { select: { id: true, name: true, isActive: true } },
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'UPDATE_PRINTER',
      entity: 'printer',
      metadata: { printerId: id, branchId },
    });

    return updated;
  }

  async testPrint(branchId: string, id: string) {
    const printer = await this.prisma.printer.findFirst({
      where: { id, branchId },
      include: {
        station: { select: { code: true } },
      },
    });
    if (!printer) {
      throw new NotFoundException('Printer not found');
    }

    const routeLabel = printer.station?.code ?? printer.printerRole;
    return {
      message: `Logical print test dispatched to ${printer.name}`,
      printer: {
        id: printer.id,
        name: printer.name,
        role: printer.printerRole,
        routeLabel,
        connectionType: printer.type,
        ipAddress: printer.ipAddress,
        copyCount: printer.copyCount,
      },
    };
  }

  async previewRoute(branchId: string, query: PreviewPrinterRouteDto) {
    if (!query.productId && !query.stationId) {
      throw new BadRequestException('Provide productId or stationId for route preview');
    }

    let stationId = query.stationId ?? null;

    if (!stationId && query.productId) {
      const route = await this.prisma.productStationRoute.findFirst({
        where: {
          branchId,
          productId: query.productId,
        },
        select: {
          stationId: true,
          station: { select: { id: true, name: true, code: true } },
        },
      });

      if (!route) {
        throw new NotFoundException('No station route found for product');
      }

      stationId = route.stationId;
    }

    const station = await this.prisma.station.findFirst({
      where: {
        id: stationId!,
        branchId,
      },
      select: { id: true, name: true, code: true },
    });

    if (!station) {
      throw new NotFoundException('Station not found');
    }

    const directPrinters = await this.prisma.printer.findMany({
      where: {
        branchId,
        isActive: true,
        stationId: station.id,
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });

    const rolePrinters = await this.prisma.printer.findMany({
      where: {
        branchId,
        isActive: true,
        stationId: null,
        printerRole: station.code === 'BAR' ? 'BAR' : 'KITCHEN',
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });

    const selected = directPrinters[0] ?? rolePrinters[0] ?? null;
    const fallback = selected?.fallbackPrinterId
      ? await this.prisma.printer.findFirst({
          where: {
            id: selected.fallbackPrinterId,
            branchId,
            isActive: true,
          },
          select: { id: true, name: true, printerRole: true, type: true, ipAddress: true },
        })
      : null;

    return {
      station,
      selectedPrinter: selected
        ? {
            id: selected.id,
            name: selected.name,
            printerRole: selected.printerRole,
            connectionType: selected.type,
            ipAddress: selected.ipAddress,
            priority: selected.priority,
          }
        : null,
      fallbackPrinter: fallback,
      candidates: [...directPrinters, ...rolePrinters].map((printer) => ({
        id: printer.id,
        name: printer.name,
        printerRole: printer.printerRole,
        connectionType: printer.type,
        ipAddress: printer.ipAddress,
        stationId: printer.stationId,
        priority: printer.priority,
      })),
      selectionPolicy: 'priority_asc_then_createdAt',
    };
  }

  private async validateRelations(
    branchId: string,
    stationId?: string,
    fallbackPrinterId?: string,
    currentPrinterId?: string,
  ) {
    if (stationId) {
      const station = await this.prisma.station.findFirst({
        where: { id: stationId, branchId },
        select: { id: true },
      });
      if (!station) {
        throw new BadRequestException('stationId is invalid for branch');
      }
    }

    if (fallbackPrinterId) {
      if (fallbackPrinterId === currentPrinterId) {
        throw new ConflictException('Printer cannot fallback to itself');
      }
      const fallbackPrinter = await this.prisma.printer.findFirst({
        where: { id: fallbackPrinterId, branchId },
        select: { id: true },
      });
      if (!fallbackPrinter) {
        throw new BadRequestException('fallbackPrinterId is invalid for branch');
      }
    }
  }
}
