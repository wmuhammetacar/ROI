-- Phase 8: low-stock operational threshold for ingredients
ALTER TABLE "Ingredient"
  ADD COLUMN "lowStockThreshold" DECIMAL(14,3) NOT NULL DEFAULT 0;

CREATE INDEX "Ingredient_branchId_isActive_lowStockThreshold_idx"
  ON "Ingredient"("branchId", "isActive", "lowStockThreshold");
