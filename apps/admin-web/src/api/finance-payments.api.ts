import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import { appendBranchScope, withQuery } from './branch-scope';
import type { PaymentRefundsResponse, PaymentVoidResponse, Refund, RefundPayload, VoidPaymentPayload } from './finance-types';

export function createFinancePaymentsApi(client: ApiClient) {
  return {
    voidPayment(id: string, payload: VoidPaymentPayload) {
      return client.post<PaymentVoidResponse>(`/payments/${id}/void`, payload);
    },
    createRefund(id: string, payload: RefundPayload) {
      return client.post<Refund>(`/payments/${id}/refunds`, payload);
    },
    getRefunds(id: string, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<PaymentRefundsResponse>(withQuery(`/payments/${id}/refunds`, params));
    },
  };
}

export const financePaymentsApi = createFinancePaymentsApi(adminApiClient);
