import test from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { AuthController } from '../../src/modules/auth/auth.controller';

test('auth register is blocked in production mode', () => {
  const authService = {
    register: async () => ({ ok: true }),
  };
  const configService = {
    get: () => 'production',
  };

  const controller = new AuthController(authService as never, configService as never);

  assert.throws(
    () =>
      controller.register(
        {
          name: 'User',
          email: 'user@example.com',
          password: 'RoiPassword123',
          branchId: 'branch-1',
        },
        { ip: '127.0.0.1', headers: {} } as never,
      ),
    ForbiddenException,
  );
});
