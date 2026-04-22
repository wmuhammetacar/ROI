import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BranchIntegrationConfigStatus,
  ExternalOrderIngestionStatus,
  IntegrationSyncDirection,
  IntegrationSyncStatus,
  Prisma,
  ServiceType,
} from '@prisma/client';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BranchesService } from '../branches/branches.service';
import { AddCatalogOrderItemDto } from '../orders/dto/add-catalog-order-item.dto';
import { CreateOrderDto } from '../orders/dto/create-order.dto';
import { OrdersService } from '../orders/orders.service';
import { IntegrationAdapterRegistry } from './integration-adapter.registry';
import { NormalizedExternalOrder } from './adapters/integration-adapter.interface';
import { CreateBranchIntegrationConfigDto } from './dto/create-branch-integration-config.dto';
import { CreateMenuMappingDto } from './dto/create-menu-mapping.dto';
import { ListBranchIntegrationConfigsDto } from './dto/list-branch-integration-configs.dto';
import { ListExternalOrdersDto } from './dto/list-external-orders.dto';
import { ListIntegrationProvidersDto } from './dto/list-integration-providers.dto';
import { ListMenuMappingsDto } from './dto/list-menu-mappings.dto';
import { ListSyncAttemptsDto } from './dto/list-sync-attempts.dto';
import { TestIngestOrderDto } from './dto/test-ingest-order.dto';
import { UpdateBranchIntegrationConfigDto } from './dto/update-branch-integration-config.dto';
import { UpdateMenuMappingDto } from './dto/update-menu-mapping.dto';

@Injectable()
export class IntegrationsService implements OnModuleInit {
  private readonly logger = new Logger(IntegrationsService.name);
  private readonly credentialsKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly branchesService: BranchesService,
    private readonly ordersService: OrdersService,
    private readonly auditService: AuditService,
    private readonly adapterRegistry: IntegrationAdapterRegistry,
  ) {
    this.credentialsKey = createHash('sha256')
      .update(this.configService.getOrThrow<string>('INTEGRATION_CREDENTIALS_ENCRYPTION_KEY'))
      .digest();
  }

  async onModuleInit() {
    const defaultProviders: Array<{
      code: string;
      name: string;
      providerType: 'MARKETPLACE';
      isActive: boolean;
    }> = [
      { code: 'MOCK_MARKETPLACE', name: 'Mock Marketplace', providerType: 'MARKETPLACE', isActive: true },
      { code: 'YEMEKSEPETI', name: 'Yemeksepeti', providerType: 'MARKETPLACE', isActive: true },
      { code: 'GETIRYEMEK', name: 'GetirYemek', providerType: 'MARKETPLACE', isActive: true },
      { code: 'TRENDYOL_YEMEK', name: 'TrendyolYemek', providerType: 'MARKETPLACE', isActive: true },
    ];

    for (const provider of defaultProviders) {
      await this.prisma.integrationProvider.upsert({
        where: { code: provider.code },
        update: {
          name: provider.name,
          providerType: provider.providerType,
          isActive: provider.isActive,
        },
        create: provider,
      });
    }

    this.logger.log(`Integration providers are ready (${defaultProviders.length} seeded entries).`);
  }

  async listProviders(query: ListIntegrationProvidersDto) {
    return this.prisma.integrationProvider.findMany({
      where: {
        providerType: query.providerType,
        isActive: query.isActive,
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async getProviderById(id: string) {
    const provider = await this.prisma.integrationProvider.findUnique({
      where: { id },
    });

    if (!provider) {
      throw new NotFoundException('Integration provider not found');
    }

    return provider;
  }

  async listConfigs(branchId: string, query: ListBranchIntegrationConfigsDto) {
    const configs = await this.prisma.branchIntegrationConfig.findMany({
      where: {
        branchId,
        providerId: query.providerId,
        status: query.status,
      },
      include: {
        provider: true,
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: query.limit,
    });

    return configs.map((item) => this.sanitizeConfigResponse(item));
  }

  async getConfigById(branchId: string, id: string) {
    const config = await this.prisma.branchIntegrationConfig.findFirst({
      where: { id, branchId },
      include: {
        provider: true,
      },
    });

    if (!config) {
      throw new NotFoundException('Integration config not found');
    }

    return this.sanitizeConfigResponse(config);
  }

  async createConfig(actor: AuthUser, dto: CreateBranchIntegrationConfigDto) {
    await this.ensureBranchExists(dto.branchId);
    const provider = await this.ensureProviderExists(dto.providerId);

    const existing = await this.prisma.branchIntegrationConfig.findUnique({
      where: {
        branchId_providerId: {
          branchId: dto.branchId,
          providerId: dto.providerId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Branch integration config already exists for this provider');
    }

    const created = await this.prisma.branchIntegrationConfig.create({
      data: {
        branchId: dto.branchId,
        providerId: dto.providerId,
        status: dto.status ?? BranchIntegrationConfigStatus.INACTIVE,
        credentialsJson: this.toNullableJson(this.encryptCredentials(dto.credentialsJson)),
        settingsJson: this.toNullableJson(dto.settingsJson),
      },
      include: { provider: true },
    });

    await this.auditService.logAction({
      userId: actor.sub,
      action: 'CREATE_BRANCH_INTEGRATION_CONFIG',
      entity: 'branch_integration_config',
      metadata: {
        configId: created.id,
        branchId: created.branchId,
        providerId: created.providerId,
        providerCode: provider.code,
        status: created.status,
      },
    });

    return this.sanitizeConfigResponse(created);
  }

  async updateConfig(actor: AuthUser, id: string, dto: UpdateBranchIntegrationConfigDto) {
    const existing = await this.findConfigById(id);

    const updated = await this.prisma.branchIntegrationConfig.update({
      where: { id: existing.id },
      data: {
        status: dto.status ?? existing.status,
        ...(dto.credentialsJson !== undefined
          ? {
              credentialsJson: this.toNullableJson(this.encryptCredentials(dto.credentialsJson)),
            }
          : {}),
        ...(dto.settingsJson !== undefined
          ? {
              settingsJson: this.toNullableJson(dto.settingsJson),
            }
          : {}),
      },
      include: { provider: true },
    });

    await this.auditService.logAction({
      userId: actor.sub,
      action: 'UPDATE_BRANCH_INTEGRATION_CONFIG',
      entity: 'branch_integration_config',
      metadata: {
        configId: updated.id,
        branchId: updated.branchId,
        providerId: updated.providerId,
        status: updated.status,
      },
    });

    return this.sanitizeConfigResponse(updated);
  }

  async updateConfigStatus(actor: AuthUser, id: string, status: BranchIntegrationConfigStatus) {
    const existing = await this.findConfigById(id);

    const updated = await this.prisma.branchIntegrationConfig.update({
      where: { id: existing.id },
      data: { status },
      include: { provider: true },
    });

    await this.auditService.logAction({
      userId: actor.sub,
      action: 'UPDATE_BRANCH_INTEGRATION_CONFIG_STATUS',
      entity: 'branch_integration_config',
      metadata: {
        configId: updated.id,
        branchId: updated.branchId,
        providerId: updated.providerId,
        fromStatus: existing.status,
        toStatus: updated.status,
      },
    });

    return this.sanitizeConfigResponse(updated);
  }

  async listMenuMappings(branchId: string, query: ListMenuMappingsDto) {
    return this.prisma.menuMapping.findMany({
      where: {
        branchId,
        providerId: query.providerId,
        isActive: query.isActive,
      },
      include: {
        provider: true,
        product: {
          select: { id: true, name: true, branchId: true },
        },
        variant: {
          select: { id: true, name: true, productId: true },
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: query.limit,
    });
  }

  async createMenuMapping(actor: AuthUser, dto: CreateMenuMappingDto) {
    await this.ensureBranchExists(dto.branchId);
    await this.ensureProviderExists(dto.providerId);
    await this.assertMappingTarget(dto.branchId, dto.productId, dto.variantId ?? null);

    const existing = await this.prisma.menuMapping.findUnique({
      where: {
        branchId_providerId_externalItemId: {
          branchId: dto.branchId,
          providerId: dto.providerId,
          externalItemId: dto.externalItemId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Menu mapping already exists for this external item');
    }

    const created = await this.prisma.menuMapping.create({
      data: {
        branchId: dto.branchId,
        providerId: dto.providerId,
        externalItemId: dto.externalItemId,
        externalItemName: dto.externalItemName,
        productId: dto.productId,
        variantId: dto.variantId ?? null,
        isActive: dto.isActive ?? true,
      },
      include: {
        provider: true,
        product: true,
        variant: true,
      },
    });

    await this.auditService.logAction({
      userId: actor.sub,
      action: 'CREATE_INTEGRATION_MENU_MAPPING',
      entity: 'menu_mapping',
      metadata: {
        menuMappingId: created.id,
        branchId: created.branchId,
        providerId: created.providerId,
        externalItemId: created.externalItemId,
        productId: created.productId,
        variantId: created.variantId,
      },
    });

    return created;
  }

  async updateMenuMapping(actor: AuthUser, id: string, dto: UpdateMenuMappingDto) {
    const existing = await this.prisma.menuMapping.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Menu mapping not found');
    }

    const nextProductId = dto.productId ?? existing.productId;
    const nextVariantId = dto.variantId !== undefined ? dto.variantId : existing.variantId;
    await this.assertMappingTarget(existing.branchId, nextProductId, nextVariantId ?? null);

    const updated = await this.prisma.menuMapping.update({
      where: { id: existing.id },
      data: {
        externalItemName: dto.externalItemName ?? existing.externalItemName,
        productId: nextProductId,
        variantId: nextVariantId ?? null,
        isActive: dto.isActive ?? existing.isActive,
      },
      include: {
        provider: true,
        product: true,
        variant: true,
      },
    });

    await this.auditService.logAction({
      userId: actor.sub,
      action: 'UPDATE_INTEGRATION_MENU_MAPPING',
      entity: 'menu_mapping',
      metadata: {
        menuMappingId: updated.id,
        branchId: updated.branchId,
        providerId: updated.providerId,
        externalItemId: updated.externalItemId,
        productId: updated.productId,
        variantId: updated.variantId,
      },
    });

    return updated;
  }

  async deleteMenuMapping(actor: AuthUser, id: string) {
    const existing = await this.prisma.menuMapping.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Menu mapping not found');
    }

    await this.prisma.menuMapping.delete({
      where: { id: existing.id },
    });

    await this.auditService.logAction({
      userId: actor.sub,
      action: 'DELETE_INTEGRATION_MENU_MAPPING',
      entity: 'menu_mapping',
      metadata: {
        menuMappingId: existing.id,
        branchId: existing.branchId,
        providerId: existing.providerId,
        externalItemId: existing.externalItemId,
      },
    });

    return {
      message: 'Menu mapping deleted successfully',
    };
  }

  async listExternalOrders(branchId: string, query: ListExternalOrdersDto) {
    return this.prisma.externalOrder.findMany({
      where: {
        branchId,
        providerId: query.providerId,
        externalOrderId: query.externalOrderId,
        ingestionStatus: query.ingestionStatus,
        serviceType: query.serviceType,
      },
      include: {
        provider: true,
        internalOrder: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            serviceType: true,
            grandTotal: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: query.limit,
    });
  }

  async getExternalOrderById(branchId: string, id: string) {
    const externalOrder = await this.prisma.externalOrder.findFirst({
      where: { id, branchId },
      include: {
        provider: true,
        internalOrder: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            serviceType: true,
            grandTotal: true,
            createdAt: true,
          },
        },
      },
    });

    if (!externalOrder) {
      throw new NotFoundException('External order not found');
    }

    return externalOrder;
  }

  async listSyncAttempts(branchId: string, query: ListSyncAttemptsDto) {
    return this.prisma.integrationSyncAttempt.findMany({
      where: {
        branchId,
        providerId: query.providerId,
        direction: query.direction,
        status: query.status,
      },
      include: {
        provider: true,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: query.limit,
    });
  }

  async testIngestOrder(actor: AuthUser, providerId: string, dto: TestIngestOrderDto) {
    const branchId = dto.branchId ?? actor.branchId;
    await this.ensureBranchExists(branchId);

    const provider = await this.ensureProviderExists(providerId, { requireActive: true });
    const adapter = this.adapterRegistry.getAdapterByProviderCode(provider.code);

    if (!adapter) {
      throw new BadRequestException(
        `No integration adapter registered for provider code "${provider.code}"`,
      );
    }

    const activeConfig = await this.prisma.branchIntegrationConfig.findFirst({
      where: {
        branchId,
        providerId: provider.id,
        status: BranchIntegrationConfigStatus.ACTIVE,
      },
      select: { id: true, credentialsJson: true },
    });

    if (!activeConfig) {
      throw new BadRequestException(
        'Active branch integration config is required before test ingestion',
      );
    }

    if (activeConfig.credentialsJson) {
      this.decryptCredentials(activeConfig.credentialsJson);
    }

    const normalized = adapter.normalizeInboundOrder(dto.payload);
    this.assertExternalServiceType(normalized.serviceType);

    const duplicate = await this.prisma.externalOrder.findUnique({
      where: {
        branchId_providerId_externalOrderId: {
          branchId,
          providerId: provider.id,
          externalOrderId: normalized.externalOrderId,
        },
      },
      include: {
        provider: true,
        internalOrder: true,
      },
    });

    if (duplicate) {
      await this.createSyncAttempt({
        branchId,
        providerId: provider.id,
        direction: IntegrationSyncDirection.INBOUND,
        operation: 'TEST_INGEST_ORDER_DUPLICATE',
        targetId: normalized.externalOrderId,
        status: IntegrationSyncStatus.SUCCESS,
        requestPayloadJson: dto.payload,
        responsePayloadJson: {
          duplicateExternalOrderId: duplicate.id,
          internalOrderId: duplicate.internalOrderId,
        },
      });

      return {
        duplicate: true,
        externalOrder: duplicate,
      };
    }

    let createdExternalOrder: { id: string };
    try {
      createdExternalOrder = await this.prisma.externalOrder.create({
        data: {
          branchId,
          providerId: provider.id,
          externalOrderId: normalized.externalOrderId,
          externalStatus: normalized.externalStatus,
          serviceType: normalized.serviceType,
          payloadJson: this.toRequiredJson(dto.payload),
          normalizedJson: this.toRequiredJson(normalized),
          ingestionStatus: ExternalOrderIngestionStatus.RECEIVED,
        },
        select: {
          id: true,
        },
      });
    } catch (error) {
      const duplicateError =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

      if (!duplicateError) {
        throw error;
      }

      const existing = await this.prisma.externalOrder.findUnique({
        where: {
          branchId_providerId_externalOrderId: {
            branchId,
            providerId: provider.id,
            externalOrderId: normalized.externalOrderId,
          },
        },
        include: {
          provider: true,
          internalOrder: true,
        },
      });

      if (!existing) {
        throw new ConflictException(
          'Duplicate external order detected but existing record could not be loaded',
        );
      }

      await this.createSyncAttempt({
        branchId,
        providerId: provider.id,
        direction: IntegrationSyncDirection.INBOUND,
        operation: 'TEST_INGEST_ORDER_DUPLICATE',
        targetId: normalized.externalOrderId,
        status: IntegrationSyncStatus.SUCCESS,
        requestPayloadJson: dto.payload,
        responsePayloadJson: {
          duplicateExternalOrderId: existing.id,
          internalOrderId: existing.internalOrderId,
          source: 'UNIQUE_INDEX_RACE',
        },
      });

      return {
        duplicate: true,
        externalOrder: existing,
      };
    }

    await this.prisma.externalOrder.update({
      where: { id: createdExternalOrder.id },
      data: {
        ingestionStatus: ExternalOrderIngestionStatus.NORMALIZED,
      },
    });

    try {
      const internalOrder = await this.createInternalOrderFromNormalizedExternalOrder(
        branchId,
        provider.id,
        actor,
        normalized,
      );

      const updatedExternalOrder = await this.prisma.externalOrder.update({
        where: { id: createdExternalOrder.id },
        data: {
          internalOrderId: internalOrder.id,
          ingestionStatus: ExternalOrderIngestionStatus.CREATED_INTERNAL_ORDER,
          failureReason: null,
        },
        include: {
          provider: true,
          internalOrder: true,
        },
      });

      await this.createSyncAttempt({
        branchId,
        providerId: provider.id,
        direction: IntegrationSyncDirection.INBOUND,
        operation: 'TEST_INGEST_ORDER',
        targetId: normalized.externalOrderId,
        status: IntegrationSyncStatus.SUCCESS,
        requestPayloadJson: dto.payload,
        responsePayloadJson: {
          externalOrderId: updatedExternalOrder.id,
          internalOrderId: internalOrder.id,
          orderNumber: internalOrder.orderNumber,
        },
      });

      await this.auditService.logAction({
        userId: actor.sub,
        action: 'INGEST_EXTERNAL_ORDER',
        entity: 'external_order',
        metadata: {
          externalOrderId: updatedExternalOrder.id,
          providerId: provider.id,
          branchId,
          internalOrderId: internalOrder.id,
          ingestionStatus: updatedExternalOrder.ingestionStatus,
        },
      });

      return {
        duplicate: false,
        externalOrder: updatedExternalOrder,
        internalOrder,
      };
    } catch (error) {
      const message = this.toErrorMessage(error);

      await this.prisma.externalOrder.update({
        where: { id: createdExternalOrder.id },
        data: {
          ingestionStatus: ExternalOrderIngestionStatus.FAILED,
          failureReason: message,
        },
      });

      await this.createSyncAttempt({
        branchId,
        providerId: provider.id,
        direction: IntegrationSyncDirection.INBOUND,
        operation: 'TEST_INGEST_ORDER',
        targetId: normalized.externalOrderId,
        status: IntegrationSyncStatus.FAILED,
        requestPayloadJson: dto.payload,
        responsePayloadJson: {
          externalOrderId: createdExternalOrder.id,
          failureReason: message,
        },
        errorMessage: message,
      });

      await this.auditService.logAction({
        userId: actor.sub,
        action: 'INGEST_EXTERNAL_ORDER_FAILED',
        entity: 'external_order',
        metadata: {
          externalOrderId: createdExternalOrder.id,
          providerId: provider.id,
          branchId,
          failureReason: message,
        },
      });

      throw error;
    }
  }

  private async createInternalOrderFromNormalizedExternalOrder(
    branchId: string,
    providerId: string,
    actor: AuthUser,
    normalized: NormalizedExternalOrder,
  ) {
    const externalItemIds = [...new Set(normalized.items.map((item) => item.externalItemId.trim()))];
    if (externalItemIds.length === 0) {
      throw new BadRequestException('Normalized external order must contain at least one mapped item');
    }

    const mappings = await this.prisma.menuMapping.findMany({
      where: {
        branchId,
        providerId,
        externalItemId: { in: externalItemIds },
        isActive: true,
      },
      include: {
        product: {
          select: { id: true, branchId: true },
        },
        variant: {
          select: { id: true, productId: true },
        },
      },
    });

    const mappingByExternalItemId = new Map(mappings.map((mapping) => [mapping.externalItemId, mapping]));

    const orderItems: AddCatalogOrderItemDto[] = normalized.items.map((item) => {
      const mapping = mappingByExternalItemId.get(item.externalItemId);
      if (!mapping) {
        throw new BadRequestException(
          `Missing active menu mapping for externalItemId "${item.externalItemId}"`,
        );
      }

      if (mapping.product.branchId !== branchId) {
        throw new BadRequestException(
          `Mapped product for externalItemId "${item.externalItemId}" belongs to a different branch`,
        );
      }

      if (mapping.variant && mapping.variant.productId !== mapping.productId) {
        throw new BadRequestException(
          `Mapped variant for externalItemId "${item.externalItemId}" does not belong to mapped product`,
        );
      }

      return {
        productId: mapping.productId,
        variantId: mapping.variantId ?? undefined,
        quantity: item.quantity,
        notes: item.notes,
        modifierSelections: [],
      };
    });

    const createOrderDto: CreateOrderDto = {
      serviceType: normalized.serviceType,
      customerName: normalized.customerName,
      customerPhone: normalized.customerPhone,
      notes: this.buildInternalOrderNote(normalized),
    };

    const createdOrder = await this.ordersService.create(branchId, actor, createOrderDto);
    let currentOrderId = createdOrder.id;

    try {
      for (const item of orderItems) {
        const order = await this.ordersService.addCatalogItem(branchId, actor, currentOrderId, item);
        currentOrderId = order.id;
      }
    } catch (error) {
      await this.safeCancelOrder(branchId, actor, currentOrderId);
      throw error;
    }

    return this.ordersService.findById(branchId, currentOrderId);
  }

  private async safeCancelOrder(branchId: string, actor: AuthUser, orderId: string) {
    try {
      await this.ordersService.cancel(branchId, actor, orderId);
    } catch {
      // Order rollback best-effort: keep original error as source of truth.
    }
  }

  private buildInternalOrderNote(normalized: NormalizedExternalOrder): string | undefined {
    const trace = `[EXT:${normalized.externalOrderId}]`;
    const raw = normalized.notes?.trim();

    if (!raw) {
      return trace;
    }

    const combined = `${trace} ${raw}`;
    return combined.slice(0, 500);
  }

  private assertExternalServiceType(serviceType: ServiceType) {
    if (serviceType !== ServiceType.DELIVERY && serviceType !== ServiceType.TAKEAWAY) {
      throw new BadRequestException('External ingestion supports only DELIVERY or TAKEAWAY service types');
    }
  }

  private async findConfigById(id: string) {
    const config = await this.prisma.branchIntegrationConfig.findUnique({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException('Integration config not found');
    }

    return config;
  }

  private async ensureProviderExists(providerId: string, options?: { requireActive?: boolean }) {
    const provider = await this.prisma.integrationProvider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      throw new NotFoundException('Integration provider not found');
    }

    if (options?.requireActive && !provider.isActive) {
      throw new BadRequestException('Integration provider is inactive');
    }

    return provider;
  }

  private async ensureBranchExists(branchId: string) {
    const exists = await this.branchesService.exists(branchId);
    if (!exists) {
      throw new NotFoundException('Branch not found');
    }
  }

  private async assertMappingTarget(branchId: string, productId: string, variantId: string | null) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        branchId,
      },
      select: { id: true, branchId: true },
    });

    if (!product) {
      throw new BadRequestException('Product not found in selected branch');
    }

    if (!variantId) {
      return;
    }

    const variant = await this.prisma.productVariant.findFirst({
      where: {
        id: variantId,
        productId: product.id,
      },
      select: {
        id: true,
      },
    });

    if (!variant) {
      throw new BadRequestException('Variant not found for mapped product');
    }
  }

  private async createSyncAttempt(input: {
    branchId: string;
    providerId: string;
    direction: IntegrationSyncDirection;
    operation: string;
    targetId?: string | null;
    status: IntegrationSyncStatus;
    requestPayloadJson?: unknown;
    responsePayloadJson?: unknown;
    errorMessage?: string | null;
  }) {
    await this.prisma.integrationSyncAttempt.create({
      data: {
        branchId: input.branchId,
        providerId: input.providerId,
        direction: input.direction,
        operation: input.operation,
        targetId: input.targetId ?? null,
        status: input.status,
        requestPayloadJson: this.toNullableJson(input.requestPayloadJson),
        responsePayloadJson: this.toNullableJson(input.responsePayloadJson),
        errorMessage: input.errorMessage ?? null,
      },
    });
  }

  private toNullableJson(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return Prisma.JsonNull;
    }

    return value as Prisma.InputJsonValue;
  }

  private toRequiredJson(value: unknown): Prisma.InputJsonValue | Prisma.JsonNullValueInput {
    if (value === null) {
      return Prisma.JsonNull;
    }

    return value as Prisma.InputJsonValue;
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return 'Unknown integration ingestion error';
  }

  private encryptCredentials(credentials: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
    if (credentials === undefined) {
      return undefined;
    }

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.credentialsKey, iv);
    const plain = Buffer.from(JSON.stringify(credentials), 'utf8');
    const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      __roiEncryptedV1: true,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      data: encrypted.toString('base64'),
    };
  }

  private decryptCredentials(credentialsJson: unknown): Record<string, unknown> | null {
    if (!credentialsJson || typeof credentialsJson !== 'object' || Array.isArray(credentialsJson)) {
      return null;
    }

    const envelope = credentialsJson as Record<string, unknown>;
    const isEncrypted = envelope.__roiEncryptedV1 === true;
    if (!isEncrypted) {
      return envelope;
    }

    const iv = typeof envelope.iv === 'string' ? envelope.iv : '';
    const tag = typeof envelope.tag === 'string' ? envelope.tag : '';
    const data = typeof envelope.data === 'string' ? envelope.data : '';
    if (!iv || !tag || !data) {
      throw new BadRequestException('Stored integration credentials are corrupted');
    }

    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.credentialsKey,
        Buffer.from(iv, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(tag, 'base64'));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(data, 'base64')),
        decipher.final(),
      ]).toString('utf8');

      const parsed = JSON.parse(decrypted);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new BadRequestException('Stored integration credentials are invalid');
      }

      return parsed as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Stored integration credentials cannot be decrypted');
    }
  }

  private sanitizeConfigResponse<T extends { credentialsJson?: unknown }>(config: T) {
    let decrypted: Record<string, unknown> | null = null;
    try {
      decrypted = this.decryptCredentials(config.credentialsJson);
    } catch {
      decrypted = null;
    }

    const credentialsPreview = this.maskCredentialsPreview(decrypted);

    return {
      ...config,
      credentialsJson: null,
      hasCredentials: Boolean(decrypted),
      credentialsMasked: credentialsPreview,
    };
  }

  private maskCredentialsPreview(value: Record<string, unknown> | null) {
    if (!value) {
      return null;
    }

    const raw = JSON.stringify(value);
    const suffix = raw.slice(-4);
    return `****${suffix}`;
  }
}
