export type ProductType = 'SIMPLE' | 'VARIABLE';
export type ModifierSelectionType = 'SINGLE' | 'MULTIPLE';

export interface Category {
  id: string;
  branchId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku: string | null;
  priceDelta: string | number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ModifierOption {
  id: string;
  modifierGroupId: string;
  name: string;
  priceDelta: string | number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ModifierGroup {
  id: string;
  branchId: string;
  name: string;
  description: string | null;
  selectionType: ModifierSelectionType;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  isActive: boolean;
  options?: ModifierOption[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductModifierGroupLink {
  id: string;
  productId: string;
  modifierGroupId: string;
  isRequired: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  modifierGroup?: ModifierGroup;
}

export interface BranchPriceOverride {
  id: string;
  branchId: string;
  productId: string;
  variantId: string | null;
  price: string | number;
  variant?: ProductVariant | null;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  branchId: string;
  categoryId: string;
  name: string;
  description: string | null;
  sku: string | null;
  imageUrl: string | null;
  basePrice: string | number;
  sortOrder: number;
  isActive: boolean;
  isAvailable: boolean;
  productType: ProductType;
  category?: Category;
  variants?: ProductVariant[];
  modifierGroupLinks?: ProductModifierGroupLink[];
  priceOverrides?: BranchPriceOverride[];
  createdAt: string;
  updatedAt: string;
}

export interface PosPreviewResponse {
  branchId: string;
  filters: {
    includeInactive: boolean;
    includeUnavailable: boolean;
  };
  categories: Array<
    Category & {
      products: Array<
        Product & {
          variants: ProductVariant[];
          modifierGroupLinks: Array<
            ProductModifierGroupLink & {
              modifierGroup: ModifierGroup & {
                options: ModifierOption[];
              };
            }
          >;
          priceOverrides: Array<
            BranchPriceOverride & {
              variant: ProductVariant | null;
            }
          >;
        }
      >;
    }
  >;
}

export interface ApiDeleteResponse {
  message: string;
}
