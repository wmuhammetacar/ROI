import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ROLES = ['admin', 'cashier', 'waiter', 'production'] as const;

const PERMISSIONS = [
  'users.read',
  'users.write',
  'roles.read',
  'roles.write',
  'branches.read',
  'branches.write',
  'audit.read',
  'audit.write',
] as const;

const ROLE_PERMISSION_MAP: Record<(typeof ROLES)[number], string[]> = {
  admin: [...PERMISSIONS],
  cashier: ['branches.read'],
  waiter: ['branches.read'],
  production: ['branches.read'],
};

async function main() {
  const defaultBranch = await prisma.branch.upsert({
    where: { name: 'Main Branch' },
    update: {},
    create: { name: 'Main Branch' },
  });

  const roles = await Promise.all(
    ROLES.map((roleName) =>
      prisma.role.upsert({
        where: { name: roleName },
        update: {},
        create: { name: roleName },
      }),
    ),
  );

  const permissions = await Promise.all(
    PERMISSIONS.map((permissionName) =>
      prisma.permission.upsert({
        where: { name: permissionName },
        update: {},
        create: { name: permissionName },
      }),
    ),
  );

  const permissionByName = new Map(permissions.map((p) => [p.name, p]));

  for (const role of roles) {
    const rolePermissionNames = ROLE_PERMISSION_MAP[role.name as (typeof ROLES)[number]] || [];

    for (const permissionName of rolePermissionNames) {
      const permission = permissionByName.get(permissionName);
      if (!permission) continue;

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }

  console.info('Seed completed.');
  console.info(`Default branch: ${defaultBranch.name}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
