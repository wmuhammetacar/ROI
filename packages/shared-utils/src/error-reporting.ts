export interface ErrorReportContext {
  app: 'admin-web' | 'pos-web' | 'kitchen-display' | 'qr-web' | string;
  area: string;
  metadata?: Record<string, unknown>;
}

export function reportClientError(error: unknown, context: ErrorReportContext) {
  const message = error instanceof Error ? error.message : String(error);
  const payload = {
    message,
    app: context.app,
    area: context.area,
    metadata: context.metadata ?? {},
  };

  console.error('[ROI_CLIENT_ERROR]', payload);
}

