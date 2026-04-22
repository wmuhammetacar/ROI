CREATE TYPE "WaiterCallType" AS ENUM ('WAITER', 'BILL', 'SERVICE');

ALTER TABLE "WaiterCall"
ADD COLUMN "callType" "WaiterCallType" NOT NULL DEFAULT 'WAITER';

CREATE INDEX "WaiterCall_branchId_callType_status_requestedAt_idx"
  ON "WaiterCall"("branchId", "callType", "status", "requestedAt");
