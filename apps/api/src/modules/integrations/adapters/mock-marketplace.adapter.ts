import { BadRequestException, Injectable } from '@nestjs/common';
import { ServiceType } from '@prisma/client';
import { IntegrationAdapter, NormalizedExternalOrder, NormalizedExternalOrderItem } from './integration-adapter.interface';

interface MockMarketplacePayload {
  orderId: unknown;
  status?: unknown;
  serviceType?: unknown;
  customer?: {
    name?: unknown;
    phone?: unknown;
  };
  notes?: unknown;
  items?: Array<{
    itemId?: unknown;
    name?: unknown;
    qty?: unknown;
    notes?: unknown;
    modifiers?: Array<{
      groupId?: unknown;
      optionId?: unknown;
      groupName?: unknown;
      optionName?: unknown;
      priceDelta?: unknown;
    }>;
  }>;
  metadata?: unknown;
}

@Injectable()
export class MockMarketplaceAdapter implements IntegrationAdapter {
  readonly code = 'MOCK_MARKETPLACE';

  normalizeInboundOrder(payload: unknown): NormalizedExternalOrder {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Inbound payload must be an object');
    }

    const input = payload as MockMarketplacePayload;
    const externalOrderId = this.requireString(input.orderId, 'orderId');
    const externalStatus = this.optionalString(input.status)?.toUpperCase() ?? 'RECEIVED';
    const serviceType = this.resolveServiceType(input.serviceType);
    const items = this.normalizeItems(input.items);

    return {
      externalOrderId,
      externalStatus,
      serviceType,
      customerName: this.optionalString(input.customer?.name),
      customerPhone: this.optionalString(input.customer?.phone),
      notes: this.optionalString(input.notes),
      items,
      metadata: this.toRecord(input.metadata),
    };
  }

  private normalizeItems(items: MockMarketplacePayload['items']): NormalizedExternalOrderItem[] {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('Inbound payload must contain at least one item');
    }

    return items.map((item, index) => {
      const externalItemId = this.requireString(item.itemId, `items[${index}].itemId`);
      const externalItemName = this.requireString(item.name, `items[${index}].name`);
      const quantity = this.requirePositiveNumber(item.qty, `items[${index}].qty`);
      const notes = this.optionalString(item.notes);

      const modifiers = Array.isArray(item.modifiers)
        ? item.modifiers
            .map((modifier, modifierIndex) => {
              const optionName = this.requireString(
                modifier.optionName,
                `items[${index}].modifiers[${modifierIndex}].optionName`,
              );

              const rawDelta = modifier.priceDelta;
              const parsedDelta =
                rawDelta === undefined || rawDelta === null
                  ? null
                  : this.requireNumber(rawDelta, `items[${index}].modifiers[${modifierIndex}].priceDelta`);

              return {
                externalGroupId: this.optionalString(modifier.groupId),
                externalOptionId: this.optionalString(modifier.optionId),
                groupName: this.optionalString(modifier.groupName),
                optionName,
                priceDelta: parsedDelta,
              };
            })
            .filter((modifier) => modifier.optionName.length > 0)
        : undefined;

      return {
        externalItemId,
        externalItemName,
        quantity,
        notes,
        modifiers,
      };
    });
  }

  private resolveServiceType(value: unknown): ServiceType {
    const normalized = this.optionalString(value)?.toUpperCase();

    if (!normalized || normalized === 'DELIVERY') {
      return ServiceType.DELIVERY;
    }

    if (normalized === 'TAKEAWAY' || normalized === 'PICKUP') {
      return ServiceType.TAKEAWAY;
    }

    throw new BadRequestException('Unsupported serviceType in inbound payload');
  }

  private requireString(value: unknown, field: string): string {
    const normalized = this.optionalString(value);
    if (!normalized) {
      throw new BadRequestException(`${field} must be a non-empty string`);
    }
    return normalized;
  }

  private optionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private requirePositiveNumber(value: unknown, field: string): number {
    const numeric = this.requireNumber(value, field);
    if (numeric <= 0) {
      throw new BadRequestException(`${field} must be greater than zero`);
    }
    return numeric;
  }

  private requireNumber(value: unknown, field: string): number {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) {
      throw new BadRequestException(`${field} must be a valid number`);
    }
    return numeric;
  }

  private toRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    return value as Record<string, unknown>;
  }
}
