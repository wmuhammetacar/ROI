import test from 'node:test';
import assert from 'node:assert/strict';
import { ServiceType } from '@prisma/client';
import { PublicOrderingService } from '../../src/modules/public-ordering/public-ordering.service';

test('public order returns existing order for duplicate idempotency key', async () => {
  const prisma = {
    publicOrderIdempotency: {
      findUnique: async () => ({
        id: 'idem-1',
        orderId: 'order-1',
        createdAt: new Date(),
        clientSessionId: 'session-1',
      }),
    },
  };

  const service = new PublicOrderingService(
    prisma as never,
    { get: () => 15 } as never,
    { exists: async () => true } as never,
    {} as never,
    {
      findById: async () => ({
        id: 'order-1',
        orderNumber: '000001',
        status: 'DRAFT',
        serviceType: ServiceType.TAKEAWAY,
        tableSessionId: null,
        grandTotal: '0',
        createdAt: new Date('2026-04-15T10:00:00.000Z'),
      }),
    } as never,
    {} as never,
    { emitToBranch: () => undefined } as never,
  );

  const result = await service.createPublicOrder(
    {
      branchId: 'branch-1',
      clientSessionId: 'session-1',
      items: [
        {
          productId: 'product-1',
          quantity: 1,
        },
      ],
    },
    { idempotencyKey: 'idem-key-1' },
  );

  assert.equal(result.orderId, 'order-1');
  assert.equal(result.idempotentReplay, true);
});
