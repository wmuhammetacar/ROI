import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import { appendBranchScope, withQuery } from './branch-scope';
import type { RegisterShift, RegisterShiftSummaryResponse } from './finance-types';
import type { InventorySummary } from './inventory-types';
import type { OrderSummary } from './finance-types';

export interface DashboardSnapshot {
  openShifts: RegisterShift[];
  closedShifts: RegisterShift[];
  latestSummary: RegisterShiftSummaryResponse | null;
  inventorySummary: InventorySummary | null;
  orders: OrderSummary[];
}

export function createDashboardApi(client: ApiClient) {
  return {
    async getSnapshot(branchId?: string): Promise<DashboardSnapshot> {
      const openShiftParams = appendBranchScope(undefined, branchId);
      openShiftParams.set('status', 'OPEN');
      openShiftParams.set('limit', '5');

      const closedShiftParams = appendBranchScope(undefined, branchId);
      closedShiftParams.set('status', 'CLOSED');
      closedShiftParams.set('limit', '5');

      const inventoryParams = appendBranchScope(undefined, branchId);
      inventoryParams.set('activeOnly', 'true');
      inventoryParams.set('limit', '200');

      const ordersParams = appendBranchScope(undefined, branchId);
      ordersParams.set('limit', '200');

      const [openShifts, closedShifts, inventorySummary, orders] = await Promise.all([
        client.get<RegisterShift[]>(withQuery('/register-shifts', openShiftParams)),
        client.get<RegisterShift[]>(withQuery('/register-shifts', closedShiftParams)),
        client.get<InventorySummary>(withQuery('/inventory/summary', inventoryParams)),
        client.get<OrderSummary[]>(withQuery('/orders', ordersParams)),
      ]);

      let latestSummary: RegisterShiftSummaryResponse | null = null;
      if (closedShifts.length > 0) {
        const summaryParams = appendBranchScope(undefined, branchId);
        latestSummary = await client.get<RegisterShiftSummaryResponse>(
          withQuery(`/register-shifts/${closedShifts[0].id}/summary`, summaryParams),
        );
      }

      return {
        openShifts,
        closedShifts,
        latestSummary,
        inventorySummary,
        orders,
      };
    },
  };
}

export const dashboardApi = createDashboardApi(adminApiClient);
