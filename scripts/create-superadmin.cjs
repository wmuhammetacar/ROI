/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
let bcrypt;
try {
  bcrypt = require('bcrypt');
} catch {
  // pnpm workspace fallback when bcryptjs is not hoisted at repo root
  bcrypt = require('../apps/api/node_modules/bcryptjs');
}

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ROI_SUPERADMIN_EMAIL || 'superadmin@roi.local';
  const password = process.env.ROI_SUPERADMIN_PASSWORD || 'Roi!Admin2026';
  const branchName = process.env.ROI_SUPERADMIN_BRANCH || 'Main Branch';

  const branch = await prisma.branch.findFirst({
    where: { name: branchName },
    select: { id: true, name: true },
  });

  if (!branch) {
    throw new Error(`Branch not found: ${branchName}`);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: 'ROI Super Admin',
      password: passwordHash,
      branchId: branch.id,
    },
    create: {
      name: 'ROI Super Admin',
      email,
      password: passwordHash,
      branchId: branch.id,
    },
    select: {
      id: true,
      email: true,
      branchId: true,
    },
  });

  const roles = await prisma.role.findMany({
    where: {
      name: {
        in: ['admin', 'cashier', 'waiter'],
      },
    },
    select: { id: true, name: true },
  });

  const roleNames = roles.map((role) => role.name);
  const requiredRoles = ['admin', 'cashier', 'waiter'];
  const missingRoles = requiredRoles.filter((role) => !roleNames.includes(role));

  if (missingRoles.length > 0) {
    throw new Error(`Missing roles: ${missingRoles.join(', ')}`);
  }

  for (const role of roles) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: role.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: role.id,
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        email: user.email,
        password,
        branchId: user.branchId,
        roles: requiredRoles,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
