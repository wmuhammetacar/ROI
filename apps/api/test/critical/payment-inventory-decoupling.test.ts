import test from 'node:test';
import assert from 'node:assert/strict';
import { PaymentsService } from '../../src/modules/payments/payments.service';

test('payment settlement does not throw when stock consumption fails', async () => {
  let txCallCount = 0;
  let auditCount = 0;
  let failedEventCount = 0;

  const prisma = {
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
      txCallCount += 1;
      return callback({});
    },
  };

  const service = new PaymentsService(
    prisma as never,
    {
      logAction: async () => {
        auditCount += 1;
      },
    } as never,
    {
      consumeOrderStockOnPaidTx: async () => {
        throw new Error('Insufficient stock for ingredient butter');
      },
    } as never,
    { emitToBranch: () => undefined } as never,
  );

  const createOrderEvent = async (_tx: unknown, input: { eventType: string }) => {
    if (input.eventType === 'STOCK_CONSUMPTION_FAILED') {
      failedEventCount += 1;
    }
  };

  (service as { createOrderEvent: typeof createOrderEvent }).createOrderEvent = createOrderEvent;

  await assert.doesNotReject(async () => {
    await (
      service as unknown as {
        consumeOrderStockPostSettlement: (
          branchId: string,
          orderId: string,
          actorUserId: string,
        ) => Promise<void>;
      }
    ).consumeOrderStockPostSettlement('branch-1', 'order-1', 'user-1');
  });

  assert.equal(txCallCount, 2);
  assert.equal(failedEventCount, 1);
  assert.equal(auditCount, 1);
});
