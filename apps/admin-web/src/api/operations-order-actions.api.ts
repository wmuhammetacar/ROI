import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import { appendBranchScope, withQuery } from './branch-scope';

export interface OperationsTable {
  id: string;
  name: string;
  status: string;
  floorId: string;
  capacity: number;
}

export interface OperationsTableSession {
  id: string;
  tableId: string;
  guestCount: number;
  status: string;
  openedAt: string;
  notes?: string | null;
}

export interface OperationsModifierSelection {
  id: string;
  modifierGroupId: string;
  modifierGroupNameSnapshot: string;
  modifierOptionId: string;
  modifierOptionNameSnapshot: string;
  priceDeltaSnapshot: string | number;
}

export interface OperationsOrderItem {
  id: string;
  orderId: string;
  productId?: string | null;
  productNameSnapshot: string;
  variantId?: string | null;
  variantNameSnapshot?: string | null;
  quantity: string | number;
  unitPrice: string | number;
  lineTotal: string | number;
  notes?: string | null;
  status: 'ACTIVE' | 'CANCELLED';
  modifierSelections: OperationsModifierSelection[];
}

export interface OperationsOrder {
  id: string;
  tableSessionId?: string | null;
  status: string;
  orderNumber: string;
  grandTotal: string | number;
  subtotal: string | number;
  billedAt?: string | null;
  paidAt?: string | null;
  items: OperationsOrderItem[];
  createdAt: string;
}

export type OperationsPaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'OTHER';

export interface OperationsOrderPayment {
  id: string;
  registerShiftId: string;
  paymentMethod: OperationsPaymentMethod;
  amount: string | number;
  status: string;
  referenceNo?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface OperationsOrderRefund {
  id: string;
  paymentTransactionId: string;
  amount: string | number;
  reason: string;
  createdAt: string;
  paymentTransaction?: {
    id: string;
    paymentMethod: OperationsPaymentMethod;
    amount: string | number;
    status: string;
  };
}

export interface OperationsOrderPaymentsResponse {
  orderId: string;
  status: string;
  billedAt?: string | null;
  paidAt?: string | null;
  financial: {
    grandTotal: string;
    paidGrossTotal: string;
    refundedTotal: string;
    netPaidTotal: string;
    outstandingBalance: string;
  };
  payments: OperationsOrderPayment[];
}

export interface OperationsRegisterShift {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  openingCashAmount: string;
}

export interface OperationsCatalogCategory {
  id: string;
  name: string;
  products: Array<{
    id: string;
    name: string;
    basePrice: string | number;
    isActive: boolean;
    isAvailable: boolean;
    allergenTags: string[];
    variants: Array<{ id: string; name: string; priceDelta: string | number; isActive: boolean }>;
    modifierGroupLinks: Array<{
      id: string;
      isRequired: boolean;
      sortOrder: number;
      modifierGroup: {
        id: string;
        name: string;
        selectionType: 'SINGLE' | 'MULTIPLE';
        minSelect: number;
        maxSelect: number;
        isActive: boolean;
        options: Array<{ id: string; name: string; priceDelta: string | number; isActive: boolean }>;
      };
    }>;
  }>;
}

export function createOperationsOrderActionsApi(client: ApiClient) {
  return {
    listTables(branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<OperationsTable[]>(withQuery('/tables', params));
    },
    getOpenSessionByTable(tableId: string) {
      return client.get<OperationsTableSession | null>(`/table-sessions/open/by-table/${tableId}`);
    },
    openSession(payload: { tableId: string; guestCount: number; notes?: string }) {
      return client.post<OperationsTableSession>('/table-sessions/open', payload);
    },
    listOrdersByTableSession(tableSessionId: string, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      params.set('tableSessionId', tableSessionId);
      params.set('limit', '5');
      return client.get<OperationsOrder[]>(withQuery('/orders', params));
    },
    getOrderById(orderId: string, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<OperationsOrder>(withQuery(`/orders/${orderId}`, params));
    },
    createOrder(payload: { serviceType: 'DINE_IN'; tableSessionId: string }) {
      return client.post<OperationsOrder>('/orders', payload);
    },
    addCatalogItem(orderId: string, payload: {
      productId: string;
      variantId?: string | null;
      quantity: number;
      notes?: string;
      modifierSelections?: Array<{ modifierGroupId: string; optionIds: string[] }>;
    }) {
      return client.post<OperationsOrder>(`/orders/${orderId}/items/catalog`, payload);
    },
    updateCatalogItem(orderId: string, itemId: string, payload: {
      productId?: string;
      variantId?: string | null;
      quantity?: number;
      notes?: string;
      modifierSelections?: Array<{ modifierGroupId: string; optionIds: string[] }>;
    }) {
      return client.patch<OperationsOrder>(`/orders/${orderId}/items/${itemId}/catalog`, payload);
    },
    removeItem(orderId: string, itemId: string) {
      return client.delete<OperationsOrder>(`/orders/${orderId}/items/${itemId}`);
    },
    sendOrder(orderId: string) {
      return client.post(`/orders/${orderId}/send`);
    },
    billOrder(orderId: string) {
      return client.post<{
        orderId: string;
        status: string;
        billedAt?: string | null;
        paidAt?: string | null;
        financial: {
          grandTotal: string;
          paidGrossTotal: string;
          refundedTotal: string;
          netPaidTotal: string;
          outstandingBalance: string;
        };
      }>(`/orders/${orderId}/bill`);
    },
    createPayment(
      orderId: string,
      payload: {
        registerShiftId: string;
        paymentMethod: OperationsPaymentMethod;
        amount: number;
        referenceNo?: string;
        notes?: string;
      },
    ) {
      return client.post<{
        payment: OperationsOrderPayment;
        orderStatus: string;
        financial: OperationsOrderPaymentsResponse['financial'];
      }>(`/orders/${orderId}/payments`, payload);
    },
    getOrderPayments(orderId: string, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<OperationsOrderPaymentsResponse>(withQuery(`/orders/${orderId}/payments`, params));
    },
    getOrderRefunds(orderId: string, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<OperationsOrderRefund[]>(withQuery(`/orders/${orderId}/refunds`, params));
    },
    getOpenShift(branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<OperationsRegisterShift | null>(withQuery('/register-shifts/open/current', params));
    },
    closeSession(sessionId: string) {
      return client.post(`/table-sessions/${sessionId}/close`);
    },
    getRouteSafeCatalog(branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      params.set('routeSafe', 'true');
      return client.get<{ categories: OperationsCatalogCategory[] }>(withQuery('/catalog/pos-products', params));
    },
  };
}

export const operationsOrderActionsApi = createOperationsOrderActionsApi(adminApiClient);
