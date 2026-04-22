-- Enforce one OPEN table session per table (race-safe)
CREATE UNIQUE INDEX IF NOT EXISTS "TableSession_single_open_per_table_idx"
  ON "TableSession" ("tableId")
  WHERE "status" = 'OPEN';

-- Enforce one OPEN register shift per user per branch (race-safe)
CREATE UNIQUE INDEX IF NOT EXISTS "RegisterShift_single_open_per_user_branch_idx"
  ON "RegisterShift" ("branchId", "openedByUserId")
  WHERE "status" = 'OPEN';
