export type StationType = 'KITCHEN' | 'BAR' | 'DESSERT' | 'PACKAGING' | 'OTHER';
export type ServiceType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'QUICK_SALE';
export type ProductionTicketStatus = 'OPEN' | 'IN_PROGRESS' | 'READY' | 'COMPLETED' | 'CANCELLED';
export type ProductionTicketItemStatus = 'QUEUED' | 'IN_PROGRESS' | 'READY' | 'COMPLETED' | 'CANCELLED';

export interface Station {
  id: string;
  branchId: string;
  name: string;
  code: string | null;
  stationType: StationType;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Table {
  id: string;
  name: string;
  capacity: number;
}

export interface TableSession {
  id: string;
  tableId: string;
  guestCount: number;
  table?: Table | null;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  serviceType: ServiceType;
  status: string;
  customerName?: string | null;
  customerPhone?: string | null;
  tableSessionId?: string | null;
}

export interface ProductionTicketItem {
  id: string;
  productionTicketId: string;
  orderId: string;
  orderItemId: string;
  branchId: string;
  stationId: string;
  productNameSnapshot: string;
  variantNameSnapshot?: string | null;
  notesSnapshot?: string | null;
  quantity: number | string;
  status: ProductionTicketItemStatus;
  firedAt: string;
  startedAt?: string | null;
  readyAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionTicket {
  id: string;
  branchId: string;
  stationId: string;
  orderId: string;
  tableSessionId?: string | null;
  serviceType: ServiceType;
  status: ProductionTicketStatus;
  createdAt: string;
  updatedAt: string;
  order?: OrderSummary | null;
  tableSession?: TableSession | null;
  items: ProductionTicketItem[];
}

export interface KdsQueueResponse {
  stationId: string;
  generatedAt: string;
  tickets: ProductionTicket[];
}

export interface KdsSummaryResponse {
  stationId: string;
  ticketStatusCounts: Record<ProductionTicketStatus, number>;
  itemStatusCounts: Record<ProductionTicketItemStatus, number>;
  totals: {
    queuedTickets: number;
    inProgressTickets: number;
    readyTickets: number;
    queuedItems: number;
    inProgressItems: number;
    readyItems: number;
  };
}

export interface ApiMessage {
  message: string;
}
