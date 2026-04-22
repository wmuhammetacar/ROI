import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma, ServiceType } from '@prisma/client';
import { IntegrationsService } from '../../src/modules/integrations/integrations.service';

test('integration ingest returns duplicate response on unique-index race', async () => {
  let findUniqueCount = 0;

  const prisma = {
    integrationProvider: {
      findUnique: async () => ({
        id: 'cp00000000000000000000001',
        code: 'MOCK_MARKETPLACE',
        name: 'Mock Marketplace',
        providerType: 'MARKETPLACE',
        isActive: true,
      }),
    },
    branchIntegrationConfig: {
      findFirst: async () => ({
        id: 'cp00000000000000000000002',
        credentialsJson: null,
      }),
    },
    externalOrder: {
      findUnique: async () => {
        findUniqueCount += 1;
        if (findUniqueCount === 1) {
          return null;
        }

        return {
          id: 'cp00000000000000000000003',
          branchId: 'cp00000000000000000000011',
          providerId: 'cp00000000000000000000001',
          externalOrderId: 'ext-101',
          internalOrderId: 'cp00000000000000000000004',
          provider: {
            id: 'cp00000000000000000000001',
            code: 'MOCK_MARKETPLACE',
            name: 'Mock Marketplace',
            providerType: 'MARKETPLACE',
            isActive: true,
          },
          internalOrder: {
            id: 'cp00000000000000000000004',
            orderNumber: '000100',
          },
        };
      },
      create: async () => {
        throw new Prisma.PrismaClientKnownRequestError('unique race', {
          code: 'P2002',
          clientVersion: 'test',
        });
      },
    },
    integrationSyncAttempt: {
      create: async () => ({ id: 'cp00000000000000000000005' }),
    },
  };

  const service = new IntegrationsService(
    prisma as never,
    { getOrThrow: () => 'integration-secret-key-minimum-32chars' } as never,
    { exists: async () => true } as never,
    {} as never,
    { logAction: async () => undefined } as never,
    {
      getAdapterByProviderCode: () => ({
        normalizeInboundOrder: () => ({
          externalOrderId: 'ext-101',
          externalStatus: 'NEW',
          serviceType: ServiceType.TAKEAWAY,
          items: [
            {
              externalItemId: 'ext-item-1',
              externalItemName: 'Croissant',
              quantity: 1,
            },
          ],
        }),
      }),
    } as never,
  );

  const result = await service.testIngestOrder(
    {
      sub: 'cp00000000000000000000099',
      email: 'admin@roi.local',
      branchId: 'cp00000000000000000000011',
      roles: ['admin'],
      permissions: [],
    },
    'cp00000000000000000000001',
    {
      branchId: 'cp00000000000000000000011',
      payload: { mock: true },
    },
  );

  assert.equal(result.duplicate, true);
  assert.equal(result.externalOrder.externalOrderId, 'ext-101');
});
