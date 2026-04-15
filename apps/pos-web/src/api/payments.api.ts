import type { ApiClient } from '@roi/api-client';
import { posApiClient } from './client';
import type { OrderPaymentsResponse, PaymentTransaction, Refund } from './pos-types';

export interface CreatePaymentPayload {
  registerShiftId: string;
  paymentMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'OTHER';
  amount: number;
  referenceNo?: string;
  notes?: string;
}

export interface CreatePaymentResult {
  payment: PaymentTransaction;
  orderStatus: string;
  financial: OrderPaymentsResponse['financial'];
}

export function createPaymentsApi(client: ApiClient) {
  return {
    createOrderPayment(orderId: string, payload: CreatePaymentPayload) {
      return client.post<CreatePaymentResult>(`/orders/${orderId}/payments`, payload);
    },
    getOrderPayments(orderId: string) {
      return client.get<OrderPaymentsResponse>(`/orders/${orderId}/payments`);
    },
    getOrderRefunds(orderId: string) {
      return client.get<Refund[]>(`/orders/${orderId}/refunds`);
    },
  };
}

export const paymentsApi = createPaymentsApi(posApiClient);
