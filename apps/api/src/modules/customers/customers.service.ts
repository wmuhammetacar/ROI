import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderItemStatus, OrderStatus, Prisma, ServiceType } from '@prisma/client';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OrdersService } from '../orders/orders.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersDto } from './dto/list-customers.dto';
import { RepeatCustomerOrderDto } from './dto/repeat-order.dto';
import { StartCustomerOrderDto } from './dto/start-customer-order.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly ordersService: OrdersService,
  ) {}

  async list(branchId: string, query: ListCustomersDto) {
    const q = query.q?.trim();
    const limit = Math.min(query.limit ?? 40, 120);

    return this.prisma.customer.findMany({
      where: {
        branchId,
        OR: q
          ? [
              { fullName: { contains: q, mode: 'insensitive' } },
              { phonePrimary: { contains: q, mode: 'insensitive' } },
              { phoneSecondary: { contains: q, mode: 'insensitive' } },
              { phoneTertiary: { contains: q, mode: 'insensitive' } },
            ]
          : undefined,
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: limit,
    });
  }

  async create(branchId: string, actor: AuthUser, dto: CreateCustomerDto) {
    const data = this.normalizeCustomerPayload(dto);
    if (!data.fullName) {
      throw new BadRequestException('fullName is required');
    }
    if (!data.phonePrimary) {
      throw new BadRequestException('phonePrimary is required');
    }

    try {
      const customer = await this.prisma.customer.create({
        data: {
          branchId,
          fullName: data.fullName,
          phonePrimary: data.phonePrimary,
          phoneSecondary: data.phoneSecondary,
          phoneTertiary: data.phoneTertiary,
          addressLine: data.addressLine,
          notes: data.notes,
          isActive: data.isActive ?? true,
        },
      });

      await this.auditService.logAction({
        userId: actor.sub,
        action: 'CREATE_CUSTOMER',
        entity: 'customer',
        metadata: {
          customerId: customer.id,
          branchId,
        },
      });

      return customer;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Primary phone already exists in branch');
      }
      throw error;
    }
  }

  async findById(branchId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        branchId,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async update(branchId: string, customerId: string, actor: AuthUser, dto: UpdateCustomerDto) {
    const customer = await this.findById(branchId, customerId);
    const data = this.normalizeCustomerPayload(dto);

    try {
      const updated = await this.prisma.customer.update({
        where: {
          id: customer.id,
        },
        data: {
          fullName: data.fullName ?? undefined,
          phonePrimary: data.phonePrimary ?? undefined,
          phoneSecondary: data.phoneSecondary ?? undefined,
          phoneTertiary: data.phoneTertiary ?? undefined,
          addressLine: data.addressLine,
          notes: data.notes,
          isActive: data.isActive,
        },
      });

      await this.auditService.logAction({
        userId: actor.sub,
        action: 'UPDATE_CUSTOMER',
        entity: 'customer',
        metadata: {
          customerId: customer.id,
          branchId,
        },
      });

      return updated;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Primary phone already exists in branch');
      }
      throw error;
    }
  }

  async getOrderHistory(branchId: string, customerId: string, limit = 20) {
    const customer = await this.findById(branchId, customerId);
    const take = Math.min(Math.max(limit, 1), 60);

    const phoneList = [customer.phonePrimary, customer.phoneSecondary, customer.phoneTertiary].filter(
      (phone): phone is string => Boolean(phone),
    );

    return this.prisma.order.findMany({
      where: {
        branchId,
        OR: [
          { customerId: customer.id },
          { customerPhone: { in: phoneList } },
        ],
      },
      include: {
        items: {
          where: {
            status: OrderItemStatus.ACTIVE,
          },
          orderBy: [{ createdAt: 'asc' }],
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take,
    });
  }

  async startPackageOrder(branchId: string, customerId: string, actor: AuthUser, dto: StartCustomerOrderDto) {
    const customer = await this.findById(branchId, customerId);
    const serviceType = dto.serviceType && dto.serviceType !== ServiceType.DINE_IN ? dto.serviceType : ServiceType.TAKEAWAY;

    const created = await this.ordersService.create(branchId, actor, {
      serviceType,
      customerId: customer.id,
      customerName: customer.fullName,
      customerPhone: customer.phonePrimary,
      notes: dto.notes,
    });

    await this.auditService.logAction({
      userId: actor.sub,
      action: 'START_CUSTOMER_PACKAGE_ORDER',
      entity: 'order',
      metadata: {
        customerId: customer.id,
        orderId: created.id,
        serviceType,
        branchId,
      },
    });

    return created;
  }

  async repeatOrder(
    branchId: string,
    customerId: string,
    sourceOrderId: string,
    actor: AuthUser,
    dto: RepeatCustomerOrderDto,
  ) {
    const customer = await this.findById(branchId, customerId);

    const source = await this.prisma.order.findFirst({
      where: {
        id: sourceOrderId,
        branchId,
        OR: [{ customerId: customer.id }, { customerPhone: customer.phonePrimary }],
      },
      include: {
        items: {
          include: {
            modifierSelections: true,
          },
          orderBy: [{ createdAt: 'asc' }],
        },
      },
    });

    if (!source) {
      throw new NotFoundException('Source order not found for customer');
    }

    if (source.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cancelled orders cannot be repeated');
    }

    const created = await this.ordersService.create(branchId, actor, {
      serviceType: source.serviceType === ServiceType.DINE_IN ? ServiceType.TAKEAWAY : source.serviceType,
      customerId: customer.id,
      customerName: customer.fullName,
      customerPhone: customer.phonePrimary,
      notes: dto.notes ?? source.notes ?? undefined,
    });

    let copiedCount = 0;
    let skippedCount = 0;

    for (const item of source.items) {
      if (item.status !== OrderItemStatus.ACTIVE || !item.productId) {
        skippedCount += 1;
        continue;
      }

      const grouped = new Map<string, string[]>();
      for (const selection of item.modifierSelections) {
        const current = grouped.get(selection.modifierGroupId) ?? [];
        current.push(selection.modifierOptionId);
        grouped.set(selection.modifierGroupId, current);
      }

      const modifierSelections = [...grouped.entries()].map(([modifierGroupId, optionIds]) => ({
        modifierGroupId,
        optionIds,
      }));

      await this.ordersService.addCatalogItem(branchId, actor, created.id, {
        productId: item.productId,
        variantId: item.variantId,
        quantity: Number(item.quantity),
        notes: item.notes ?? undefined,
        modifierSelections,
      });
      copiedCount += 1;
    }

    if (copiedCount === 0) {
      throw new BadRequestException('No repeatable catalog items found in source order');
    }

    const refreshed = await this.ordersService.findById(branchId, created.id);

    await this.auditService.logAction({
      userId: actor.sub,
      action: 'REPEAT_CUSTOMER_ORDER',
      entity: 'order',
      metadata: {
        customerId: customer.id,
        sourceOrderId,
        repeatedOrderId: created.id,
        copiedCount,
        skippedCount,
        branchId,
      },
    });

    return {
      order: refreshed,
      copiedCount,
      skippedCount,
    };
  }

  private normalizePhone(value?: string | null) {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = trimmed.replace(/[^0-9+]/g, '');
    if (normalized.length < 7) {
      throw new BadRequestException('Phone number is too short');
    }
    if (normalized.length > 24) {
      throw new BadRequestException('Phone number is too long');
    }
    return normalized;
  }

  private normalizeCustomerPayload(dto: Partial<CreateCustomerDto | UpdateCustomerDto>) {
    const fullName = dto.fullName?.trim();
    const phonePrimary = this.normalizePhone(dto.phonePrimary ?? undefined);
    const phoneSecondary = this.normalizePhone(dto.phoneSecondary ?? undefined);
    const phoneTertiary = this.normalizePhone(dto.phoneTertiary ?? undefined);

    const uniquePhones = [phonePrimary, phoneSecondary, phoneTertiary].filter(
      (phone): phone is string => Boolean(phone),
    );
    const uniqueSet = new Set(uniquePhones);
    if (uniqueSet.size !== uniquePhones.length) {
      throw new BadRequestException('Phone numbers must be unique per customer record');
    }

    return {
      fullName,
      phonePrimary,
      phoneSecondary,
      phoneTertiary,
      addressLine: dto.addressLine?.trim() || null,
      notes: dto.notes?.trim() || null,
      isActive: dto.isActive,
    };
  }
}
