import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ModifierSelectionType,
  OrderItemStatus,
  OrderStatus,
  Prisma,
  ProductType,
  ServiceType,
  TableSessionStatus,
} from '@prisma/client';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { REALTIME_EVENTS } from '../realtime/realtime-events.constants';
import { RealtimeEventsService } from '../realtime/realtime-events.service';
import { AddCatalogOrderItemDto } from './dto/add-catalog-order-item.dto';
import { AddOrderItemDto } from './dto/add-order-item.dto';
import { CatalogModifierSelectionDto } from './dto/catalog-modifier-selection.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import { UpdateCatalogOrderItemDto } from './dto/update-catalog-order-item.dto';
import { UpdateOrderItemDto } from './dto/update-order-item.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { ORDER_EVENT_TYPES } from './domain/order-events.constants';
import {
  assertOrderCancellable,
  assertOrderEditable,
  assertServiceTypeMatchesTableSessionRules,
  assertValidOrderTransition,
  assertWaiterScope,
} from './domain/order.rules';

interface CatalogModifierSelectionInput {
  modifierGroupId: string;
  optionIds: string[];
}

interface ResolvedOrderItemModifierSnapshot {
  modifierGroupId: string;
  modifierGroupNameSnapshot: string;
  modifierOptionId: string;
  modifierOptionNameSnapshot: string;
  priceDeltaSnapshot: Prisma.Decimal;
}

interface ResolvedCatalogCommercialData {
  productId: string;
  productNameSnapshot: string;
  baseProductPriceSnapshot: Prisma.Decimal;
  variantId: string | null;
  variantNameSnapshot: string | null;
  variantPriceDeltaSnapshot: Prisma.Decimal | null;
  unitPrice: Prisma.Decimal;
  modifierSelections: ResolvedOrderItemModifierSnapshot[];
}

type OrderItemWithModifierSelections = Prisma.OrderItemGetPayload<{
  include: { modifierSelections: true };
}>;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly realtimeEvents: RealtimeEventsService,
  ) {}

  async create(branchId: string, actor: AuthUser, dto: CreateOrderDto) {
    assertWaiterScope(actor, dto.serviceType);
    assertServiceTypeMatchesTableSessionRules(dto.serviceType, dto.tableSessionId);

    const tableSession = await this.resolveAndValidateTableSession(
      branchId,
      dto.serviceType,
      dto.tableSessionId,
    );

    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: {
          id: dto.customerId,
          branchId,
          isActive: true,
        },
        select: { id: true },
      });

      if (!customer) {
        throw new NotFoundException('Customer not found in current branch');
      }
    }

    const order = await this.createOrderWithSequence(branchId, actor.sub, dto, tableSession?.id);

    await this.auditService.logAction({
      userId: actor.sub,
      action: 'CREATE_ORDER',
      entity: 'order',
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        serviceType: order.serviceType,
        branchId,
      },
    });

    const response = await this.findById(branchId, order.id);
    this.realtimeEvents.emitToBranch(branchId, REALTIME_EVENTS.ORDER_CREATED, {
      orderId: response.id,
      orderNumber: response.orderNumber,
      tableSessionId: response.tableSessionId,
      serviceType: response.serviceType,
      status: response.status,
    });
    return response;
  }

  async findById(branchId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        branchId,
      },
      include: {
        items: {
          include: {
            modifierSelections: {
              orderBy: [{ createdAt: 'asc' }],
            },
          },
          orderBy: [{ createdAt: 'asc' }],
        },
        tableSession: {
          include: {
            table: true,
          },
        },
        customer: {
          select: {
            id: true,
            fullName: true,
            phonePrimary: true,
          },
        },
        events: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async findAll(branchId: string, query: ListOrdersDto) {
    return this.prisma.order.findMany({
      where: {
        branchId,
        status: query.status,
        serviceType: query.serviceType,
        tableSessionId: query.tableSessionId,
      },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phonePrimary: true,
          },
        },
        items: {
          where: {
            status: OrderItemStatus.ACTIVE,
          },
          include: {
            modifierSelections: {
              orderBy: [{ createdAt: 'asc' }],
            },
          },
          orderBy: [{ createdAt: 'asc' }],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: query.limit,
    });
  }

  async addItem(branchId: string, actor: AuthUser, orderId: string, dto: AddOrderItemDto) {
    if (dto.productId) {
      throw new BadRequestException('Use /orders/:id/items/catalog for catalog-backed items');
    }

    const order = await this.getOrderForMutation(branchId, orderId, actor);

    const stationCode = dto.stationCode?.trim().toUpperCase();
    let stationId: string | null = null;

    if (stationCode) {
      const station = await this.prisma.station.findFirst({
        where: {
          branchId,
          code: stationCode,
          isActive: true,
        },
        select: {
          id: true,
          code: true,
        },
      });

      if (!station) {
        throw new BadRequestException(`Station not found or inactive for code: ${stationCode}`);
      }

      stationId = station.id;
    }

    const quantity = new Prisma.Decimal(dto.quantity);
    const unitPrice = new Prisma.Decimal(dto.unitPrice);
    const lineTotal = quantity.mul(unitPrice);

    const result = await this.prisma.$transaction(async (tx) => {
      const item = await tx.orderItem.create({
        data: {
          orderId: order.id,
          productNameSnapshot: dto.productNameSnapshot.trim(),
          productId: null,
          variantId: null,
          variantNameSnapshot: null,
          baseProductPriceSnapshot: null,
          variantPriceDeltaSnapshot: null,
          stationId,
          quantity,
          unitPrice,
          lineTotal,
          notes: dto.notes,
          status: OrderItemStatus.ACTIVE,
        },
      });

      await this.recalculateOrderTotals(tx, order.id);
      await this.createOrderEvent(tx, {
        orderId: order.id,
        actorUserId: actor.sub,
        eventType: ORDER_EVENT_TYPES.ITEM_ADDED,
        payloadJson: {
          itemId: item.id,
          quantity: quantity.toString(),
          unitPrice: unitPrice.toString(),
          lineTotal: lineTotal.toString(),
          stationCode,
        },
      });

      return item;
    });

    await this.auditService.logAction({
      userId: actor.sub,
      action: 'ADD_ORDER_ITEM',
      entity: 'order_item',
      metadata: {
        orderId: order.id,
        itemId: result.id,
        entryType: 'manual',
        stationCode,
      },
    });

    const response = await this.findById(branchId, order.id);
    this.emitOrderUpdated(branchId, response, 'item_added');
    return response;
  }

  async addCatalogItem(
    branchId: string,
    actor: AuthUser,
    orderId: string,
    dto: AddCatalogOrderItemDto,
  ) {
    const order = await this.getOrderForMutation(branchId, orderId, actor);

    const quantity = new Prisma.Decimal(dto.quantity);
    const commercialData = await this.resolveCatalogCommercialData(branchId, {
      productId: dto.productId,
      variantId: dto.variantId ?? null,
      modifierSelections: dto.modifierSelections,
    });

    const lineTotal = quantity.mul(commercialData.unitPrice);

    const result = await this.prisma.$transaction(async (tx) => {
      const item = await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId: commercialData.productId,
          productNameSnapshot: commercialData.productNameSnapshot,
          variantId: commercialData.variantId,
          variantNameSnapshot: commercialData.variantNameSnapshot,
          baseProductPriceSnapshot: commercialData.baseProductPriceSnapshot,
          variantPriceDeltaSnapshot: commercialData.variantPriceDeltaSnapshot,
          quantity,
          unitPrice: commercialData.unitPrice,
          lineTotal,
          notes: dto.notes,
          status: OrderItemStatus.ACTIVE,
        },
      });

      if (commercialData.modifierSelections.length > 0) {
        await tx.orderItemModifierSelection.createMany({
          data: commercialData.modifierSelections.map((selection) => ({
            orderItemId: item.id,
            modifierGroupId: selection.modifierGroupId,
            modifierGroupNameSnapshot: selection.modifierGroupNameSnapshot,
            modifierOptionId: selection.modifierOptionId,
            modifierOptionNameSnapshot: selection.modifierOptionNameSnapshot,
            priceDeltaSnapshot: selection.priceDeltaSnapshot,
          })),
        });
      }

      await this.recalculateOrderTotals(tx, order.id);

      await this.createOrderEvent(tx, {
        orderId: order.id,
        actorUserId: actor.sub,
        eventType: ORDER_EVENT_TYPES.ITEM_CATALOG_ADDED,
        payloadJson: {
          itemId: item.id,
          productId: commercialData.productId,
          variantId: commercialData.variantId,
          quantity: quantity.toString(),
          unitPrice: commercialData.unitPrice.toString(),
          lineTotal: lineTotal.toString(),
          modifierSelections: commercialData.modifierSelections.map((selection) => ({
            modifierGroupId: selection.modifierGroupId,
            modifierOptionId: selection.modifierOptionId,
            priceDeltaSnapshot: selection.priceDeltaSnapshot.toString(),
          })),
        },
      });

      await this.createOrderEvent(tx, {
        orderId: order.id,
        actorUserId: actor.sub,
        eventType: ORDER_EVENT_TYPES.ITEM_REPRICED,
        payloadJson: {
          itemId: item.id,
          reason: 'catalog_add',
          previousUnitPrice: null,
          nextUnitPrice: commercialData.unitPrice.toString(),
          baseProductPriceSnapshot: commercialData.baseProductPriceSnapshot.toString(),
          variantPriceDeltaSnapshot: commercialData.variantPriceDeltaSnapshot?.toString() ?? null,
        },
      });

      return item;
    });

    await this.auditService.logAction({
      userId: actor.sub,
      action: 'ADD_ORDER_ITEM_CATALOG',
      entity: 'order_item',
      metadata: {
        orderId: order.id,
        itemId: result.id,
        productId: commercialData.productId,
        variantId: commercialData.variantId,
      },
    });

    const response = await this.findById(branchId, order.id);
    this.emitOrderUpdated(branchId, response, 'item_catalog_added');
    return response;
  }

  async updateItem(
    branchId: string,
    actor: AuthUser,
    orderId: string,
    itemId: string,
    dto: UpdateOrderItemDto,
  ) {
    if (dto.productId) {
      throw new BadRequestException('Use /orders/:id/items/:itemId/catalog for catalog-backed items');
    }

    const order = await this.getOrderForMutation(branchId, orderId, actor);

    const currentItem = await this.prisma.orderItem.findFirst({
      where: {
        id: itemId,
        orderId: order.id,
      },
    });

    if (!currentItem) {
      throw new NotFoundException('Order item not found');
    }

    if (currentItem.productId) {
      throw new BadRequestException('Catalog-backed items must be updated via /orders/:id/items/:itemId/catalog');
    }

    if (currentItem.status === OrderItemStatus.CANCELLED) {
      throw new ConflictException('Cancelled items cannot be updated');
    }

    const quantity = dto.quantity !== undefined ? new Prisma.Decimal(dto.quantity) : currentItem.quantity;
    const unitPrice = dto.unitPrice !== undefined ? new Prisma.Decimal(dto.unitPrice) : currentItem.unitPrice;
    const lineTotal = quantity.mul(unitPrice);

    const payload = {
      previous: {
        quantity: currentItem.quantity.toString(),
        unitPrice: currentItem.unitPrice.toString(),
        lineTotal: currentItem.lineTotal.toString(),
      },
      next: {
        quantity: quantity.toString(),
        unitPrice: unitPrice.toString(),
        lineTotal: lineTotal.toString(),
      },
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.update({
        where: {
          id: currentItem.id,
        },
        data: {
          productNameSnapshot:
            dto.productNameSnapshot !== undefined
              ? dto.productNameSnapshot.trim()
              : currentItem.productNameSnapshot,
          productId: null,
          variantId: null,
          variantNameSnapshot: null,
          baseProductPriceSnapshot: null,
          variantPriceDeltaSnapshot: null,
          quantity,
          unitPrice,
          lineTotal,
          notes: dto.notes !== undefined ? dto.notes : currentItem.notes,
        },
      });

      await this.recalculateOrderTotals(tx, order.id);
      await this.createOrderEvent(tx, {
        orderId: order.id,
        actorUserId: actor.sub,
        eventType: ORDER_EVENT_TYPES.ITEM_UPDATED,
        payloadJson: {
          itemId: currentItem.id,
          ...payload,
        },
      });
    });

    await this.auditService.logAction({
      userId: actor.sub,
      action: 'UPDATE_ORDER_ITEM',
      entity: 'order_item',
      metadata: {
        orderId: order.id,
        itemId: currentItem.id,
        entryType: 'manual',
      },
    });

    const response = await this.findById(branchId, order.id);
    this.emitOrderUpdated(branchId, response, 'item_updated');
    return response;
  }

  async updateCatalogItem(
    branchId: string,
    actor: AuthUser,
    orderId: string,
    itemId: string,
    dto: UpdateCatalogOrderItemDto,
  ) {
    const order = await this.getOrderForMutation(branchId, orderId, actor);

    if (!this.hasAnyCatalogUpdateInput(dto)) {
      throw new BadRequestException('At least one catalog item field must be provided for update');
    }

    const currentItem = await this.prisma.orderItem.findFirst({
      where: {
        id: itemId,
        orderId: order.id,
      },
      include: {
        modifierSelections: true,
      },
    });

    if (!currentItem) {
      throw new NotFoundException('Order item not found');
    }

    if (currentItem.status === OrderItemStatus.CANCELLED) {
      throw new ConflictException('Cancelled items cannot be updated');
    }

    const nextProductId = dto.productId ?? currentItem.productId;
    if (!nextProductId) {
      throw new BadRequestException(
        'Item does not have productId snapshot. Provide productId to convert it into catalog-backed item.',
      );
    }

    const hasVariantField = Object.prototype.hasOwnProperty.call(dto, 'variantId');
    const nextVariantId = hasVariantField ? dto.variantId ?? null : currentItem.variantId ?? null;

    const nextQuantity = dto.quantity !== undefined ? new Prisma.Decimal(dto.quantity) : currentItem.quantity;
    const nextNotes = dto.notes !== undefined ? dto.notes : currentItem.notes;

    const nextModifierSelections =
      dto.modifierSelections !== undefined
        ? dto.modifierSelections
        : this.buildModifierSelectionsInputFromItem(currentItem);

    const commercialData = await this.resolveCatalogCommercialData(branchId, {
      productId: nextProductId,
      variantId: nextVariantId,
      modifierSelections: nextModifierSelections,
    });

    const nextLineTotal = nextQuantity.mul(commercialData.unitPrice);

    await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.update({
        where: {
          id: currentItem.id,
        },
        data: {
          productId: commercialData.productId,
          productNameSnapshot: commercialData.productNameSnapshot,
          variantId: commercialData.variantId,
          variantNameSnapshot: commercialData.variantNameSnapshot,
          baseProductPriceSnapshot: commercialData.baseProductPriceSnapshot,
          variantPriceDeltaSnapshot: commercialData.variantPriceDeltaSnapshot,
          quantity: nextQuantity,
          unitPrice: commercialData.unitPrice,
          lineTotal: nextLineTotal,
          notes: nextNotes,
        },
      });

      await tx.orderItemModifierSelection.deleteMany({
        where: {
          orderItemId: currentItem.id,
        },
      });

      if (commercialData.modifierSelections.length > 0) {
        await tx.orderItemModifierSelection.createMany({
          data: commercialData.modifierSelections.map((selection) => ({
            orderItemId: currentItem.id,
            modifierGroupId: selection.modifierGroupId,
            modifierGroupNameSnapshot: selection.modifierGroupNameSnapshot,
            modifierOptionId: selection.modifierOptionId,
            modifierOptionNameSnapshot: selection.modifierOptionNameSnapshot,
            priceDeltaSnapshot: selection.priceDeltaSnapshot,
          })),
        });
      }

      await this.recalculateOrderTotals(tx, order.id);

      await this.createOrderEvent(tx, {
        orderId: order.id,
        actorUserId: actor.sub,
        eventType: ORDER_EVENT_TYPES.ITEM_CATALOG_UPDATED,
        payloadJson: {
          itemId: currentItem.id,
          previous: {
            productId: currentItem.productId,
            variantId: currentItem.variantId,
            quantity: currentItem.quantity.toString(),
            unitPrice: currentItem.unitPrice.toString(),
            lineTotal: currentItem.lineTotal.toString(),
          },
          next: {
            productId: commercialData.productId,
            variantId: commercialData.variantId,
            quantity: nextQuantity.toString(),
            unitPrice: commercialData.unitPrice.toString(),
            lineTotal: nextLineTotal.toString(),
          },
        },
      });

      await this.createOrderEvent(tx, {
        orderId: order.id,
        actorUserId: actor.sub,
        eventType: ORDER_EVENT_TYPES.ITEM_REPRICED,
        payloadJson: {
          itemId: currentItem.id,
          reason: 'catalog_update',
          previousUnitPrice: currentItem.unitPrice.toString(),
          nextUnitPrice: commercialData.unitPrice.toString(),
          baseProductPriceSnapshot: commercialData.baseProductPriceSnapshot.toString(),
          variantPriceDeltaSnapshot: commercialData.variantPriceDeltaSnapshot?.toString() ?? null,
        },
      });
    });

    await this.auditService.logAction({
      userId: actor.sub,
      action: 'UPDATE_ORDER_ITEM_CATALOG',
      entity: 'order_item',
      metadata: {
        orderId: order.id,
        itemId: currentItem.id,
        productId: commercialData.productId,
        variantId: commercialData.variantId,
      },
    });

    const response = await this.findById(branchId, order.id);
    this.emitOrderUpdated(branchId, response, 'item_catalog_updated');
    return response;
  }

  async removeItem(branchId: string, actor: AuthUser, orderId: string, itemId: string) {
    const order = await this.getOrderForMutation(branchId, orderId, actor);

    const currentItem = await this.prisma.orderItem.findFirst({
      where: {
        id: itemId,
        orderId: order.id,
      },
    });

    if (!currentItem) {
      throw new NotFoundException('Order item not found');
    }

    if (currentItem.status === OrderItemStatus.CANCELLED) {
      throw new ConflictException('Order item is already cancelled');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.update({
        where: {
          id: currentItem.id,
        },
        data: {
          status: OrderItemStatus.CANCELLED,
        },
      });

      await this.recalculateOrderTotals(tx, order.id);

      const eventType = currentItem.productId
        ? ORDER_EVENT_TYPES.ITEM_CATALOG_REMOVED
        : ORDER_EVENT_TYPES.ITEM_REMOVED;

      await this.createOrderEvent(tx, {
        orderId: order.id,
        actorUserId: actor.sub,
        eventType,
        payloadJson: {
          itemId: currentItem.id,
          productId: currentItem.productId,
          variantId: currentItem.variantId,
        },
      });
    });

    await this.auditService.logAction({
      userId: actor.sub,
      action: 'REMOVE_ORDER_ITEM',
      entity: 'order_item',
      metadata: {
        orderId: order.id,
        itemId: currentItem.id,
      },
    });

    const response = await this.findById(branchId, order.id);
    this.emitOrderUpdated(branchId, response, 'item_removed');
    return response;
  }

  async updateStatus(
    branchId: string,
    actor: AuthUser,
    orderId: string,
    dto: UpdateOrderStatusDto,
  ) {
    if (dto.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Use /orders/:id/cancel endpoint to cancel an order');
    }

    if (dto.status === OrderStatus.PAID) {
      throw new BadRequestException('Use order payment settlement endpoints to mark an order as PAID');
    }

    const order = await this.getOrderForStatusUpdate(branchId, orderId, actor);

    assertValidOrderTransition(order.status, dto.status);

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: {
          id: order.id,
        },
        data: {
          status: dto.status,
        },
      });

      await this.createOrderEvent(tx, {
        orderId: order.id,
        actorUserId: actor.sub,
        eventType: ORDER_EVENT_TYPES.STATUS_CHANGED,
        payloadJson: {
          from: order.status,
          to: dto.status,
        },
      });
    });

    await this.auditService.logAction({
      userId: actor.sub,
      action: 'UPDATE_ORDER_STATUS',
      entity: 'order',
      metadata: {
        orderId: order.id,
        from: order.status,
        to: dto.status,
      },
    });

    const response = await this.findById(branchId, order.id);
    this.emitOrderStatusChanged(branchId, response, order.status, dto.status);
    return response;
  }

  async cancel(branchId: string, actor: AuthUser, orderId: string) {
    const order = await this.getOrderForStatusUpdate(branchId, orderId, actor);

    assertOrderCancellable(order.status);

    await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.updateMany({
        where: {
          orderId: order.id,
          status: OrderItemStatus.ACTIVE,
        },
        data: {
          status: OrderItemStatus.CANCELLED,
        },
      });

      await tx.order.update({
        where: {
          id: order.id,
        },
        data: {
          status: OrderStatus.CANCELLED,
        },
      });

      await this.recalculateOrderTotals(tx, order.id);
      await this.createOrderEvent(tx, {
        orderId: order.id,
        actorUserId: actor.sub,
        eventType: ORDER_EVENT_TYPES.ORDER_CANCELLED,
        payloadJson: {
          from: order.status,
          to: OrderStatus.CANCELLED,
        },
      });
    });

    await this.auditService.logAction({
      userId: actor.sub,
      action: 'CANCEL_ORDER',
      entity: 'order',
      metadata: {
        orderId: order.id,
        from: order.status,
        to: OrderStatus.CANCELLED,
      },
    });

    const response = await this.findById(branchId, order.id);
    this.emitOrderStatusChanged(branchId, response, order.status, OrderStatus.CANCELLED);
    return response;
  }

  async findEvents(branchId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        branchId,
      },
      select: { id: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.prisma.orderEvent.findMany({
      where: {
        orderId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  private async getOrderForMutation(branchId: string, orderId: string, actor: AuthUser) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        branchId,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    assertWaiterScope(actor, order.serviceType);
    assertOrderEditable(order.status);

    return order;
  }

  private async getOrderForStatusUpdate(branchId: string, orderId: string, actor: AuthUser) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        branchId,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    assertWaiterScope(actor, order.serviceType);

    return order;
  }

  private async resolveAndValidateTableSession(
    branchId: string,
    serviceType: ServiceType,
    tableSessionId?: string,
  ) {
    if (!tableSessionId) {
      return null;
    }

    const tableSession = await this.prisma.tableSession.findFirst({
      where: {
        id: tableSessionId,
        branchId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!tableSession) {
      throw new NotFoundException('Table session not found in current branch');
    }

    if (tableSession.status !== TableSessionStatus.OPEN) {
      throw new ConflictException('Table session must be OPEN to create or attach an order');
    }

    if (serviceType === ServiceType.DINE_IN && !tableSessionId) {
      throw new BadRequestException('DINE_IN orders require tableSessionId');
    }

    return tableSession;
  }

  private async createOrderWithSequence(
    branchId: string,
    actorUserId: string,
    dto: CreateOrderDto,
    tableSessionId?: string,
  ) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const count = await tx.order.count({
            where: { branchId },
          });

          const orderNumber = String(count + 1 + attempt).padStart(6, '0');

          const order = await tx.order.create({
            data: {
              branchId,
              tableSessionId,
              serviceType: dto.serviceType,
              status: OrderStatus.DRAFT,
              orderNumber,
              customerId: dto.customerId,
              customerName: dto.customerName,
              customerPhone: dto.customerPhone,
              notes: dto.notes,
              subtotal: new Prisma.Decimal(0),
              discountTotal: new Prisma.Decimal(0),
              grandTotal: new Prisma.Decimal(0),
              createdByUserId: actorUserId,
            },
          });

          await this.createOrderEvent(tx, {
            orderId: order.id,
            actorUserId,
            eventType: ORDER_EVENT_TYPES.ORDER_CREATED,
            payloadJson: {
              serviceType: dto.serviceType,
              tableSessionId: tableSessionId ?? null,
            },
          });

          return order;
        });
      } catch (error) {
        const isUniqueViolation =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

        if (!isUniqueViolation || attempt === 4) {
          throw error;
        }
      }
    }

    throw new ConflictException('Failed to generate a unique order number');
  }

  private async resolveCatalogCommercialData(
    branchId: string,
    input: {
      productId: string;
      variantId: string | null;
      modifierSelections?: CatalogModifierSelectionDto[] | CatalogModifierSelectionInput[];
    },
  ): Promise<ResolvedCatalogCommercialData> {
    const product = await this.prisma.product.findFirst({
      where: {
        id: input.productId,
        branchId,
      },
      include: {
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
          where: {
            branchId,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found in current branch');
    }

    if (!product.isActive) {
      throw new ConflictException('Product is inactive and cannot be ordered');
    }

    if (!product.isAvailable) {
      throw new ConflictException('Product is unavailable and cannot be ordered');
    }

    let variant: {
      id: string;
      name: string;
      priceDelta: Prisma.Decimal;
      isActive: boolean;
    } | null = null;

    if (product.productType === ProductType.VARIABLE && !input.variantId) {
      throw new BadRequestException('Variant selection is required for variable products');
    }

    if (product.productType === ProductType.SIMPLE && input.variantId) {
      throw new BadRequestException('Simple products cannot receive variant selection');
    }

    if (input.variantId) {
      const foundVariant = await this.prisma.productVariant.findFirst({
        where: {
          id: input.variantId,
          productId: product.id,
        },
        select: {
          id: true,
          name: true,
          priceDelta: true,
          isActive: true,
        },
      });

      if (!foundVariant) {
        throw new BadRequestException('Variant not found for the selected product');
      }

      if (!foundVariant.isActive) {
        throw new ConflictException('Variant is inactive and cannot be ordered');
      }

      variant = foundVariant;
    }

    const normalizedSelections = this.normalizeModifierSelections(input.modifierSelections);
    const requestedSelectionsMap = new Map<string, string[]>();

    for (const selection of normalizedSelections) {
      requestedSelectionsMap.set(selection.modifierGroupId, selection.optionIds);
    }

    const modifierSelections: ResolvedOrderItemModifierSnapshot[] = [];

    const modifierGroupLinkMap = new Map(
      product.modifierGroupLinks.map((link) => [link.modifierGroupId, link]),
    );

    for (const selection of normalizedSelections) {
      if (!modifierGroupLinkMap.has(selection.modifierGroupId)) {
        throw new BadRequestException(
          `Modifier group ${selection.modifierGroupId} is not linked to the selected product`,
        );
      }
    }

    for (const link of product.modifierGroupLinks) {
      const group = link.modifierGroup;

      if (group.branchId !== branchId) {
        throw new ConflictException('Modifier group branch mismatch detected for selected product');
      }

      const selectedOptionIds = requestedSelectionsMap.get(group.id) ?? [];
      const selectedCount = selectedOptionIds.length;
      const groupWasProvidedInRequest = requestedSelectionsMap.has(group.id);

      if (!group.isActive) {
        if (groupWasProvidedInRequest) {
          throw new ConflictException(`Modifier group ${group.name} is inactive`);
        }

        if (link.isRequired) {
          throw new ConflictException(
            `Required modifier group ${group.name} is inactive and blocks ordering`,
          );
        }

        continue;
      }

      if (group.selectionType === ModifierSelectionType.SINGLE && selectedCount > 1) {
        throw new BadRequestException(
          `Modifier group ${group.name} allows only one selected option`,
        );
      }

      if (selectedCount > group.maxSelect) {
        throw new BadRequestException(
          `Modifier group ${group.name} exceeded max selections (${group.maxSelect})`,
        );
      }

      if (selectedCount > 0 && selectedCount < group.minSelect) {
        throw new BadRequestException(
          `Modifier group ${group.name} requires at least ${group.minSelect} selections when used`,
        );
      }

      const requiredMinimumSelection = link.isRequired ? Math.max(1, group.minSelect) : 0;
      if (selectedCount < requiredMinimumSelection) {
        throw new BadRequestException(
          `Modifier group ${group.name} requires at least ${requiredMinimumSelection} selections`,
        );
      }

      const optionMap = new Map(group.options.map((option) => [option.id, option]));

      for (const optionId of selectedOptionIds) {
        const option = optionMap.get(optionId);

        if (!option) {
          throw new BadRequestException(
            `Modifier option ${optionId} does not belong to group ${group.name}`,
          );
        }

        if (!option.isActive) {
          throw new ConflictException(`Modifier option ${option.name} is inactive`);
        }

        modifierSelections.push({
          modifierGroupId: group.id,
          modifierGroupNameSnapshot: group.name,
          modifierOptionId: option.id,
          modifierOptionNameSnapshot: option.name,
          priceDeltaSnapshot: option.priceDelta,
        });
      }
    }

    const baseOverride = product.priceOverrides.find((override) => override.variantId === null);
    const baseProductPriceSnapshot = baseOverride?.price ?? product.basePrice;

    let variantPriceDeltaSnapshot: Prisma.Decimal | null = null;
    if (variant) {
      const variantOverride = product.priceOverrides.find((override) => override.variantId === variant.id);

      variantPriceDeltaSnapshot = variantOverride
        ? variantOverride.price.minus(baseProductPriceSnapshot)
        : variant.priceDelta;
    }

    const modifierDeltaTotal = modifierSelections.reduce(
      (acc, selection) => acc.plus(selection.priceDeltaSnapshot),
      new Prisma.Decimal(0),
    );

    const unitPrice = baseProductPriceSnapshot
      .plus(variantPriceDeltaSnapshot ?? new Prisma.Decimal(0))
      .plus(modifierDeltaTotal);

    if (unitPrice.lessThan(0)) {
      throw new ConflictException('Effective unit price cannot be negative');
    }

    return {
      productId: product.id,
      productNameSnapshot: product.name,
      baseProductPriceSnapshot,
      variantId: variant?.id ?? null,
      variantNameSnapshot: variant?.name ?? null,
      variantPriceDeltaSnapshot,
      unitPrice,
      modifierSelections,
    };
  }

  private normalizeModifierSelections(
    selections?: CatalogModifierSelectionDto[] | CatalogModifierSelectionInput[],
  ): CatalogModifierSelectionInput[] {
    if (!selections || selections.length === 0) {
      return [];
    }

    const normalized: CatalogModifierSelectionInput[] = [];
    const seenGroups = new Set<string>();

    for (const rawSelection of selections) {
      const modifierGroupId = rawSelection.modifierGroupId.trim();

      if (!modifierGroupId) {
        throw new BadRequestException('modifierGroupId cannot be empty');
      }

      if (seenGroups.has(modifierGroupId)) {
        throw new BadRequestException(`Duplicate modifierGroupId ${modifierGroupId} in selections`);
      }

      seenGroups.add(modifierGroupId);

      const seenOptions = new Set<string>();
      const optionIds: string[] = [];

      for (const rawOptionId of rawSelection.optionIds ?? []) {
        const optionId = rawOptionId.trim();

        if (!optionId) {
          throw new BadRequestException(`Empty optionId found in modifier group ${modifierGroupId}`);
        }

        if (seenOptions.has(optionId)) {
          throw new BadRequestException(
            `Duplicate optionId ${optionId} in modifier group ${modifierGroupId}`,
          );
        }

        seenOptions.add(optionId);
        optionIds.push(optionId);
      }

      normalized.push({
        modifierGroupId,
        optionIds,
      });
    }

    return normalized;
  }

  private buildModifierSelectionsInputFromItem(
    item: OrderItemWithModifierSelections,
  ): CatalogModifierSelectionInput[] {
    const grouped = new Map<string, string[]>();

    for (const selection of item.modifierSelections) {
      const existing = grouped.get(selection.modifierGroupId);
      if (existing) {
        existing.push(selection.modifierOptionId);
      } else {
        grouped.set(selection.modifierGroupId, [selection.modifierOptionId]);
      }
    }

    return Array.from(grouped.entries()).map(([modifierGroupId, optionIds]) => ({
      modifierGroupId,
      optionIds,
    }));
  }

  private hasAnyCatalogUpdateInput(dto: UpdateCatalogOrderItemDto): boolean {
    return (
      dto.productId !== undefined ||
      Object.prototype.hasOwnProperty.call(dto, 'variantId') ||
      dto.quantity !== undefined ||
      dto.notes !== undefined ||
      dto.modifierSelections !== undefined
    );
  }

  private async createOrderEvent(
    tx: Prisma.TransactionClient,
    input: {
      orderId: string;
      eventType: string;
      actorUserId: string;
      payloadJson?: Prisma.InputJsonValue;
    },
  ) {
    await tx.orderEvent.create({
      data: {
        orderId: input.orderId,
        eventType: input.eventType,
        actorUserId: input.actorUserId,
        payloadJson: input.payloadJson,
      },
    });
  }

  private async recalculateOrderTotals(tx: Prisma.TransactionClient, orderId: string) {
    const aggregate = await tx.orderItem.aggregate({
      where: {
        orderId,
        status: OrderItemStatus.ACTIVE,
      },
      _sum: {
        lineTotal: true,
      },
    });

    const subtotal = aggregate._sum.lineTotal ?? new Prisma.Decimal(0);
    const discountTotal = new Prisma.Decimal(0);
    const grandTotal = subtotal.minus(discountTotal);

    await tx.order.update({
      where: {
        id: orderId,
      },
      data: {
        subtotal,
        discountTotal,
        grandTotal,
      },
    });
  }

  private emitOrderUpdated(
    branchId: string,
    order: {
      id: string;
      orderNumber: string;
      tableSessionId: string | null;
      status: OrderStatus;
      grandTotal: Prisma.Decimal;
      items: unknown[];
    },
    reason: string,
  ) {
    this.realtimeEvents.emitToBranch(branchId, REALTIME_EVENTS.ORDER_UPDATED, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      tableSessionId: order.tableSessionId,
      status: order.status,
      reason,
      grandTotal: order.grandTotal.toString(),
      activeItemCount: Array.isArray(order.items) ? order.items.length : 0,
    });
  }

  private emitOrderStatusChanged(
    branchId: string,
    order: {
      id: string;
      orderNumber: string;
      tableSessionId: string | null;
      status: OrderStatus;
    },
    previousStatus: OrderStatus,
    nextStatus: OrderStatus,
  ) {
    this.realtimeEvents.emitToBranch(branchId, REALTIME_EVENTS.ORDER_STATUS_CHANGED, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      tableSessionId: order.tableSessionId,
      previousStatus,
      nextStatus,
      status: order.status,
    });
  }
}
