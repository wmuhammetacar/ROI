import { Injectable, Logger } from '@nestjs/common';
import { PrinterRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

interface TicketPrintItem {
  productName: string;
  quantity: number | string;
  note?: string | null;
}

@Injectable()
export class PrinterRoutingService {
  private readonly logger = new Logger(PrinterRoutingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async printTicket(branchId: string, stationId: string, stationCode: string, items: TicketPrintItem[]) {
    if (items.length === 0) {
      return;
    }

    const stationPrinters = await this.prisma.printer.findMany({
      where: {
        branchId,
        stationId,
        isActive: true,
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        type: true,
        ipAddress: true,
        copyCount: true,
        priority: true,
        fallbackPrinterId: true,
      },
    });

    const roleFallback = stationCode === 'BAR' ? PrinterRole.BAR : PrinterRole.KITCHEN;
    const rolePrinters = await this.prisma.printer.findMany({
      where: {
        branchId,
        stationId: null,
        printerRole: roleFallback,
        isActive: true,
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        type: true,
        ipAddress: true,
        copyCount: true,
        priority: true,
        fallbackPrinterId: true,
      },
    });

    const printers = stationPrinters.length > 0 ? stationPrinters : rolePrinters;
    const selected = printers[0] ?? null;
    const fallbackPrinter =
      selected?.fallbackPrinterId
        ? await this.prisma.printer.findFirst({
            where: {
              id: selected.fallbackPrinterId,
              branchId,
              isActive: true,
            },
            select: {
              id: true,
              name: true,
              type: true,
              ipAddress: true,
              copyCount: true,
              priority: true,
            },
          })
        : null;

    const printerHint = selected
      ? ` -> ${selected.name}${selected.ipAddress ? `(${selected.ipAddress})` : ''} [priority=${selected.priority}]${fallbackPrinter ? ` | fallback=${fallbackPrinter.name}` : ''}`
      : ' -> NO_PRINTER_CONFIGURED';

    this.logger.log(`[PRINT - ${stationCode}]${printerHint}`);

    const copies = Math.max(1, selected?.copyCount ?? 1);

    for (const item of items) {
      const qty = Number(item.quantity);
      const normalizedQty = Number.isFinite(qty) ? qty : item.quantity;
      const noteSuffix = item.note?.trim() ? ` | note: ${item.note.trim()}` : '';
      for (let i = 0; i < copies; i += 1) {
        this.logger.log(`* ${item.productName} x${normalizedQty}${noteSuffix} [copy ${i + 1}/${copies}]`);
      }
    }
  }
}
