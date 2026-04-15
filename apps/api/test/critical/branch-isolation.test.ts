import test from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { BranchScopeResolverService } from '../../src/modules/branches/branch-scope-resolver.service';

test('non-admin users cannot override read branch scope', async () => {
  const resolver = new BranchScopeResolverService({
    exists: async () => true,
  } as never);

  await assert.rejects(
    () =>
      resolver.resolveReadBranchId(
        {
          sub: 'user-1',
          email: 'cashier@roi.local',
          branchId: 'branch-a',
          roles: ['cashier'],
          permissions: [],
        },
        'branch-b',
      ),
    ForbiddenException,
  );
});
