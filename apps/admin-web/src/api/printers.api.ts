import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import { appendBranchScope, withQuery } from './branch-scope';

export type PrinterRole = 'CASH' | 'KITCHEN' | 'BAR' | 'REPORT' | 'DAY_END' | 'INVOICE' | 'BARCODE' | 'PACKAGE';
export type PrinterType = 'USB' | 'NETWORK';

export interface PrinterRecord {
  id: string;
  branchId: string;
  name: string;
  printerRole: PrinterRole;
  type: PrinterType;
  stationId?: string | null;
  ipAddress?: string | null;
  fallbackPrinterId?: string | null;
  copyCount: number;
  priority: number;
  isActive: boolean;
  station?: { id: string; name: string; code: string } | null;
  fallbackPrinter?: { id: string; name: string; isActive: boolean } | null;
}

export interface PrinterRoutePreview {
  station: { id: string; name: string; code: string };
  selectedPrinter: null | {
    id: string;
    name: string;
    printerRole: PrinterRole;
    connectionType: PrinterType;
    ipAddress?: string | null;
    priority: number;
  };
  fallbackPrinter: null | {
    id: string;
    name: string;
    printerRole: PrinterRole;
    type: PrinterType;
    ipAddress?: string | null;
  };
  candidates: Array<{
    id: string;
    name: string;
    printerRole: PrinterRole;
    connectionType: PrinterType;
    ipAddress?: string | null;
    stationId?: string | null;
    priority: number;
  }>;
  selectionPolicy: 'priority_asc_then_createdAt';
}

export function createPrintersApi(client: ApiClient) {
  return {
    list(branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<PrinterRecord[]>(withQuery('/printers', params));
    },
    create(payload: {
      name: string;
      printerRole: PrinterRole;
      type: PrinterType;
      stationId?: string;
      ipAddress?: string;
      fallbackPrinterId?: string;
      copyCount?: number;
      priority?: number;
      isActive?: boolean;
    }) {
      return client.post<PrinterRecord>('/printers', payload);
    },
    update(
      id: string,
      payload: Partial<{
        name: string;
        printerRole: PrinterRole;
        type: PrinterType;
        stationId?: string | null;
        ipAddress?: string;
        fallbackPrinterId?: string | null;
        copyCount?: number;
        priority?: number;
        isActive?: boolean;
      }>,
    ) {
      return client.patch<PrinterRecord>(`/printers/${id}`, payload);
    },
    test(id: string) {
      return client.post<{ message: string }>(`/printers/${id}/test`);
    },
    previewRoute(payload: { productId?: string; stationId?: string }) {
      const params = new URLSearchParams();
      if (payload.productId) params.set('productId', payload.productId);
      if (payload.stationId) params.set('stationId', payload.stationId);
      return client.get<PrinterRoutePreview>(withQuery('/printers/routing/preview', params));
    },
  };
}

export const printersApi = createPrintersApi(adminApiClient);
