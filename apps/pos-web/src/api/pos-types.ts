export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'OUT_OF_SERVICE';
export type TableSessionStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';
export type ServiceType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'QUICK_SALE';
export type OrderStatus =
  | 'DRAFT'
  | 'PLACED'
  | 'SENT_TO_STATION'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'BILLED'
  | 'PAID'
  | 'CANCELLED';
export type ProductType = 'SIMPLE' | 'VARIABLE';
export type ModifierSelectionType = 'SINGLE' | 'MULTIPLE';
export type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'OTHER';
export type PaymentTransactionStatus = 'COMPLETED' | 'VOIDED' | 'REFUNDED_PARTIAL' | 'REFUNDED_FULL';

export interface Floor {
  id: string;
  branchId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Table {
  id: string;
  branchId: string;
  floorId: string;
  name: string;
  capacity: number;
  status: TableStatus;
  floor?: Floor;
  createdAt: string;
  updatedAt: string;
}

export interface TableSession {
  id: string;
  branchId: string;
  tableId: string;
  openedByUserId: string;
  assignedWaiterId?: string | null;
  guestCount: number;
  status: TableSessionStatus;
  openedAt: string;
  closedAt?: string | null;
  notes?: string | null;
  table?: Table;
  createdAt: string;
  updatedAt: string;
}

export interface PosCatalogOption {
  id: string;
  modifierGroupId: string;
  name: string;
  priceDelta: string | number;
  sortOrder: number;
  isActive: boolean;
}

export interface PosCatalogModifierGroup {
  id: string;
  branchId: string;
  name: string;
  description: string | null;
  selectionType: ModifierSelectionType;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  isActive: boolean;
  options: PosCatalogOption[];
}

export interface PosCatalogModifierLink {
  id: string;
  productId: string;
  modifierGroupId: string;
  isRequired: boolean;
  sortOrder: number;
  modifierGroup: PosCatalogModifierGroup;
}

export interface PosCatalogVariant {
  id: string;
  productId: string;
  name: string;
  sku: string | null;
  priceDelta: string | number;
  sortOrder: number;
  isActive: boolean;
}

export interface PosCatalogProduct {
  id: string;
  branchId: string;
  categoryId: string;
  name: string;
  description: string | null;
  allergenTags: string[];
  sku: string | null;
  imageUrl: string | null;
  basePrice: string | number;
  sortOrder: number;
  isActive: boolean;
  isAvailable: boolean;
  productType: ProductType;
  variants: PosCatalogVariant[];
  modifierGroupLinks: PosCatalogModifierLink[];
}

export interface PosCatalogCategory {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  products: PosCatalogProduct[];
}

export interface PosCatalogResponse {
  branchId: string;
  filters: {
    includeInactive: boolean;
    includeUnavailable: boolean;
    routeSafe?: boolean;
  };
  categories: PosCatalogCategory[];
}

export interface OrderItemModifierSelection {
  id: string;
  modifierGroupId: string;
  modifierGroupNameSnapshot: string;
  modifierOptionId: string;
  modifierOptionNameSnapshot: string;
  priceDeltaSnapshot: string | number;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productNameSnapshot: string;
  productId?: string | null;
  variantId?: string | null;
  variantNameSnapshot?: string | null;
  baseProductPriceSnapshot?: string | number | null;
  variantPriceDeltaSnapshot?: string | number | null;
  quantity: string | number;
  unitPrice: string | number;
  lineTotal: string | number;
  notes?: string | null;
  status: 'ACTIVE' | 'CANCELLED';
  modifierSelections: OrderItemModifierSelection[];
}

export interface Order {
  id: string;
  branchId: string;
  tableSessionId?: string | null;
  serviceType: ServiceType;
  status: OrderStatus;
  orderNumber: string;
  subtotal: string | number;
  discountTotal: string | number;
  grandTotal: string | number;
  billedAt?: string | null;
  paidAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  tableSession?: TableSession | null;
}

export interface RegisterShift {
  id: string;
  branchId: string;
  openedByUserId: string;
  closedByUserId?: string | null;
  openingCashAmount: string;
  closingCashAmountExpected?: string | null;
  closingCashAmountActual?: string | null;
  varianceAmount?: string | null;
  status: 'OPEN' | 'CLOSED';
  notes?: string | null;
  openedAt: string;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  openedByUser?: { id: string; name: string; email: string } | null;
}

export interface Refund {
  id: string;
  orderId: string;
  paymentTransactionId: string;
  amount: string | number;
  reason: string;
  createdAt: string;
  paymentTransaction?: {
    id: string;
    paymentMethod: PaymentMethod;
    amount: string | number;
    status: PaymentTransactionStatus;
    registerShiftId?: string | null;
  };
}

export interface PaymentTransaction {
  id: string;
  orderId: string;
  registerShiftId: string;
  paymentMethod: PaymentMethod;
  amount: string | number;
  status: PaymentTransactionStatus;
  referenceNo?: string | null;
  notes?: string | null;
  createdAt: string;
  refunds?: Refund[];
  registerShift?: {
    id: string;
    status: string;
    openedAt: string;
    closedAt?: string | null;
  };
}

export interface OrderPaymentsResponse {
  orderId: string;
  status: OrderStatus;
  billedAt?: string | null;
  paidAt?: string | null;
  financial: {
    grandTotal: string;
    paidGrossTotal: string;
    refundedTotal: string;
    netPaidTotal: string;
    outstandingBalance: string;
  };
  payments: PaymentTransaction[];
}

export interface ApiMessage {
  message: string;
}
