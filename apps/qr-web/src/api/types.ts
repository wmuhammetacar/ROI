export type ModifierSelectionType = 'SINGLE' | 'MULTIPLE';
export type ServiceType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'QUICK_SALE';
export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'OUT_OF_SERVICE';

export interface PosCatalogOption {
  id: string;
  name: string;
  priceDelta: string | number;
  sortOrder: number;
}

export interface PosCatalogModifierGroup {
  id: string;
  name: string;
  selectionType: ModifierSelectionType;
  minSelect: number;
  maxSelect: number;
  options: PosCatalogOption[];
}

export interface PosCatalogModifierLink {
  id: string;
  modifierGroupId: string;
  isRequired: boolean;
  sortOrder: number;
  modifierGroup: PosCatalogModifierGroup;
}

export interface PosCatalogVariant {
  id: string;
  name: string;
  priceDelta: string | number;
  sortOrder: number;
  isActive: boolean;
}

export interface PosCatalogProduct {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  basePrice: string | number;
  sortOrder: number;
  isAvailable: boolean;
  variants: PosCatalogVariant[];
  modifierGroupLinks: PosCatalogModifierLink[];
}

export interface PosCatalogCategory {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  products: PosCatalogProduct[];
}

export interface PublicMenuResponse {
  context: {
    branchId: string;
    tableId: string | null;
    tableName: string | null;
    tableStatus: TableStatus | null;
    suggestedServiceType: ServiceType;
  };
  menu: {
    branchId: string;
    categories: PosCatalogCategory[];
  };
}

export interface PublicOrderModifierSelection {
  modifierGroupId: string;
  optionIds?: string[];
}

export interface PublicOrderItemPayload {
  productId: string;
  variantId?: string | null;
  quantity: number;
  notes?: string;
  modifierSelections?: PublicOrderModifierSelection[];
}

export interface PublicCreateOrderPayload {
  branchId: string;
  tableId?: string;
  clientSessionId?: string;
  idempotencyKey?: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  items: PublicOrderItemPayload[];
}

export interface PublicOrderSubmissionResponse {
  orderId: string;
  orderNumber: string;
  status: string;
  serviceType: ServiceType;
  tableSessionId?: string | null;
  grandTotal: string | number;
  createdAt: string;
  idempotentReplay?: boolean;
}
