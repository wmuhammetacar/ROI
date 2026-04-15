import type { ApiClient } from '@roi/api-client';
import { posApiClient } from './client';
import { createPaymentsApi } from './payments.api';

export function createOrderPaymentsApi(client: ApiClient) {
  const paymentsApi = createPaymentsApi(client);

  return {
    billOrder(orderId: string) {
      return client.post(`/orders/${orderId}/bill`);
    },
    createPayment: paymentsApi.createOrderPayment,
    getPayments: paymentsApi.getOrderPayments,
    getRefunds: paymentsApi.getOrderRefunds,
  };
}

export const orderPaymentsApi = createOrderPaymentsApi(posApiClient);
