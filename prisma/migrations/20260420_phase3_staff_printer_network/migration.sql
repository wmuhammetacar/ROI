-- CreateEnum
CREATE TYPE "PrinterRole" AS ENUM ('CASH', 'KITCHEN', 'BAR', 'REPORT', 'DAY_END', 'INVOICE', 'BARCODE', 'PACKAGE');

-- AlterTable Branch
ALTER TABLE "Branch"
ADD COLUMN "allowedNetworkCidrs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable User
ALTER TABLE "User"
ADD COLUMN "username" TEXT,
ADD COLUMN "pinHash" TEXT,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "password" DROP NOT NULL;

-- Backfill usernames from email local-part
UPDATE "User"
SET "username" = split_part("email", '@', 1)
WHERE "username" IS NULL;

ALTER TABLE "User"
ALTER COLUMN "username" SET NOT NULL;

-- Guarantee username uniqueness even with same local-part collisions
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT id, username,
           row_number() OVER (PARTITION BY username ORDER BY "createdAt", id) AS rn
    FROM "User"
  LOOP
    IF rec.rn > 1 THEN
      UPDATE "User"
      SET "username" = rec.username || '_' || rec.rn
      WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AlterTable Printer
ALTER TABLE "Printer"
ADD COLUMN "printerRole" "PrinterRole" NOT NULL DEFAULT 'KITCHEN',
ADD COLUMN "fallbackPrinterId" TEXT,
ADD COLUMN "copyCount" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "stationId" DROP NOT NULL;

-- Drop old unique and add new
DROP INDEX IF EXISTS "Printer_branchId_stationId_name_key";
CREATE UNIQUE INDEX "Printer_branchId_name_key" ON "Printer"("branchId", "name");
CREATE INDEX "Printer_branchId_printerRole_isActive_idx" ON "Printer"("branchId", "printerRole", "isActive");

-- Add fallback FK
ALTER TABLE "Printer"
ADD CONSTRAINT "Printer_fallbackPrinterId_fkey"
FOREIGN KEY ("fallbackPrinterId") REFERENCES "Printer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
