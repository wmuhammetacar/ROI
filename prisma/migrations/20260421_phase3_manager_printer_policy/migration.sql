ALTER TABLE "Printer"
ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 100;

DROP INDEX IF EXISTS "Printer_branchId_stationId_isActive_idx";
DROP INDEX IF EXISTS "Printer_branchId_printerRole_isActive_idx";

CREATE INDEX IF NOT EXISTS "Printer_branchId_stationId_isActive_priority_createdAt_idx"
  ON "Printer"("branchId", "stationId", "isActive", "priority", "createdAt");

CREATE INDEX IF NOT EXISTS "Printer_branchId_printerRole_isActive_priority_createdAt_idx"
  ON "Printer"("branchId", "printerRole", "isActive", "priority", "createdAt");

INSERT INTO "Role" ("id", "name", "createdAt", "updatedAt")
SELECT 'role_manager', 'manager', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM "Role"
  WHERE "name" = 'manager'
);

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT role_row."id", permission_row."id", NOW()
FROM "Role" role_row
JOIN "Permission" permission_row ON permission_row."name" = 'branches.read'
WHERE role_row."name" = 'manager'
  AND NOT EXISTS (
    SELECT 1
    FROM "RolePermission" rp
    WHERE rp."roleId" = role_row."id"
      AND rp."permissionId" = permission_row."id"
  );
