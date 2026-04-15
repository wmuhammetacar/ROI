import type { ApiClient } from '@roi/api-client';
import { posApiClient } from './client';
import type { Order, OrderPaymentsResponse, Refund } from './pos-types';

export interface OrderFinanceContext {
  order: Order;
  payments: OrderPaymentsResponse;
  refunds: Refund[];
}

export function createOrderFinanceApi(client: ApiClient) {
  return {
    async getOrderFinanceContext(orderId: string): Promise<OrderFinanceContext> {
      const [order, payments, refunds] = await Promise.all([
        client.get<Order>(`/orders/${orderId}`),
        client.get<OrderPaymentsResponse>(`/orders/${orderId}/payments`),
        client.get<Refund[]>(`/orders/${orderId}/refunds`),
      ]);

      return { order, payments, refunds };
    },
  };
}

export const orderFinanceApi = createOrderFinanceApi(posApiClient);
