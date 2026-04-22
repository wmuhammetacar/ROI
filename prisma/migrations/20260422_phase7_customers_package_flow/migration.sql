-- Phase 7: customer desk + package flow foundations

CREATE TABLE "Customer" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "phonePrimary" TEXT NOT NULL,
  "phoneSecondary" TEXT,
  "phoneTertiary" TEXT,
  "addressLine" TEXT,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order"
ADD COLUMN "customerId" TEXT;

CREATE UNIQUE INDEX "Customer_branchId_phonePrimary_key" ON "Customer"("branchId", "phonePrimary");
CREATE INDEX "Customer_branchId_fullName_idx" ON "Customer"("branchId", "fullName");
CREATE INDEX "Customer_branchId_phonePrimary_phoneSecondary_phoneTertiary_idx" ON "Customer"("branchId", "phonePrimary", "phoneSecondary", "phoneTertiary");
CREATE INDEX "Order_customerId_createdAt_idx" ON "Order"("customerId", "createdAt");

ALTER TABLE "Customer"
ADD CONSTRAINT "Customer_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Order"
ADD CONSTRAINT "Order_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
