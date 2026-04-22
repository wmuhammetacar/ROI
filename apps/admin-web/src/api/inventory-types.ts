export type UnitKind = 'WEIGHT' | 'VOLUME' | 'COUNT' | 'OTHER';
export type StockMovementType = 'IN' | 'OUT' | 'ADJUSTMENT_PLUS' | 'ADJUSTMENT_MINUS' | 'WASTE';
export type StockReferenceType =
  | 'ORDER'
  | 'PAYMENT'
  | 'RECIPE_CONSUMPTION'
  | 'MANUAL_ADJUSTMENT'
  | 'WASTE_RECORD'
  | 'OTHER';

export interface UnitOfMeasure {
  id: string;
  name: string;
  code: string;
  kind: UnitKind;
  createdAt: string;
  updatedAt: string;
}

export interface Ingredient {
  id: string;
  branchId: string;
  name: string;
  sku: string | null;
  unitId: string;
  unit: UnitOfMeasure;
  currentStock: string | number;
  lowStockThreshold: string | number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IngredientDetail {
  ingredient: Ingredient;
  isLowStock: boolean;
  recentMovements: StockMovement[];
  recentWasteRecords: WasteRecord[];
  linkedRecipes: Array<{
    id: string;
    name: string;
    isActive: boolean;
    quantityPerRecipe: string | number;
    product?: { id: string; name: string } | null;
    productVariant?: {
      id: string;
      name: string;
      product?: { id: string; name: string } | null;
    } | null;
  }>;
}

export interface WasteRecord {
  id: string;
  branchId: string;
  ingredientId: string;
  quantity: string | number;
  reason: string;
  createdByUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  branchId: string;
  ingredientId: string;
  movementType: StockMovementType;
  quantity: string | number;
  balanceBefore: string | number;
  balanceAfter: string | number;
  referenceType: StockReferenceType;
  referenceId?: string | null;
  notes?: string | null;
  ingredient?: Ingredient;
  createdByUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface Recipe {
  id: string;
  branchId: string;
  productId?: string | null;
  productVariantId?: string | null;
  name: string;
  isActive: boolean;
  product?: {
    id: string;
    name: string;
  } | null;
  productVariant?: {
    id: string;
    name: string;
    product?: {
      id: string;
      name: string;
    } | null;
  } | null;
  _count?: {
    items: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface RecipeItem {
  id: string;
  recipeId: string;
  ingredientId: string;
  quantity: string | number;
  ingredient?: Ingredient;
  createdAt: string;
  updatedAt: string;
}

export interface InventorySummaryItem {
  id: string;
  name: string;
  sku: string | null;
  currentStock: string | number;
  lowStockThreshold: string | number;
  isLowStock: boolean;
  recipeUsageCount: number;
  isActive: boolean;
  unit: UnitOfMeasure;
  latestMovementAt: string | null;
}

export interface InventorySummary {
  branchId: string;
  generatedAt: string;
  totalIngredients: number;
  activeIngredients: number;
  inactiveIngredients: number;
  lowStockCount: number;
  recentMovementCount24h: number;
  recipeCoverageCount: number;
  items: InventorySummaryItem[];
}

export interface InventoryDeleteResponse {
  message: string;
}
