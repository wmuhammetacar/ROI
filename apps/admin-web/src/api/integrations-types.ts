export type IntegrationProviderType = 'MARKETPLACE' | 'ONLINE_ORDERING' | 'COURIER' | 'OTHER';
export type BranchIntegrationConfigStatus = 'ACTIVE' | 'INACTIVE' | 'ERROR';
export type ExternalOrderIngestionStatus =
  | 'RECEIVED'
  | 'NORMALIZED'
  | 'CREATED_INTERNAL_ORDER'
  | 'FAILED';
export type IntegrationSyncDirection = 'INBOUND' | 'OUTBOUND';
export type IntegrationSyncStatus = 'SUCCESS' | 'FAILED' | 'RETRY_PENDING';

export interface IntegrationProvider {
  id: string;
  code: string;
  name: string;
  providerType: IntegrationProviderType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BranchIntegrationConfig {
  id: string;
  branchId: string;
  providerId: string;
  status: BranchIntegrationConfigStatus;
  credentialsJson?: Record<string, unknown> | null;
  settingsJson?: Record<string, unknown> | null;
  lastSyncAt?: string | null;
  provider?: IntegrationProvider;
  createdAt: string;
  updatedAt: string;
}

export interface MenuMapping {
  id: string;
  branchId: string;
  providerId: string;
  externalItemId: string;
  externalItemName: string;
  productId: string;
  variantId?: string | null;
  isActive: boolean;
  provider?: IntegrationProvider;
  product?: {
    id: string;
    name: string;
    branchId?: string;
  };
  variant?: {
    id: string;
    name: string;
    productId?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalOrder {
  id: string;
  branchId: string;
  providerId: string;
  externalOrderId: string;
  externalStatus: string;
  serviceType: string;
  payloadJson: Record<string, unknown> | null;
  normalizedJson: Record<string, unknown> | null;
  internalOrderId?: string | null;
  ingestionStatus: ExternalOrderIngestionStatus;
  failureReason?: string | null;
  provider?: IntegrationProvider;
  internalOrder?: {
    id: string;
    orderNumber: string;
    status: string;
    serviceType: string;
    grandTotal: string;
    createdAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationSyncAttempt {
  id: string;
  branchId: string;
  providerId: string;
  direction: IntegrationSyncDirection;
  operation: string;
  targetId?: string | null;
  status: IntegrationSyncStatus;
  requestPayloadJson?: Record<string, unknown> | null;
  responsePayloadJson?: Record<string, unknown> | null;
  errorMessage?: string | null;
  provider?: IntegrationProvider;
  createdAt: string;
  updatedAt: string;
}

export interface TestIngestOrderResponse {
  duplicate: boolean;
  externalOrder: ExternalOrder;
  internalOrder?: {
    id: string;
    orderNumber: string;
    status: string;
    serviceType: string;
    grandTotal: string;
    createdAt: string;
  };
}
