-- CreateEnum
CREATE TYPE "PrinterType" AS ENUM ('NETWORK', 'USB');

-- CreateTable
CREATE TABLE "Printer" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "stationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "PrinterType" NOT NULL,
  "ipAddress" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Printer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Printer_branchId_stationId_name_key" ON "Printer"("branchId", "stationId", "name");

-- CreateIndex
CREATE INDEX "Printer_branchId_stationId_isActive_idx" ON "Printer"("branchId", "stationId", "isActive");

-- AddForeignKey
ALTER TABLE "Printer" ADD CONSTRAINT "Printer_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Printer" ADD CONSTRAINT "Printer_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
