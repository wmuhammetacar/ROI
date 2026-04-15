import { ServiceType } from '@prisma/client';

export interface NormalizedExternalOrderModifier {
  externalGroupId?: string | null;
  externalOptionId?: string | null;
  groupName?: string | null;
  optionName: string;
  priceDelta?: number | null;
}

export interface NormalizedExternalOrderItem {
  externalItemId: string;
  externalItemName: string;
  quantity: number;
  notes?: string;
  modifiers?: NormalizedExternalOrderModifier[];
}

export interface NormalizedExternalOrder {
  externalOrderId: string;
  externalStatus: string;
  serviceType: ServiceType;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  items: NormalizedExternalOrderItem[];
  metadata?: Record<string, unknown>;
}

export interface IntegrationAdapter {
  readonly code: string;
  normalizeInboundOrder(payload: unknown): NormalizedExternalOrder;
}
