export const ADMIN_REALTIME_EVENTS = {
  ORDER_CREATED: 'order.created',
  ORDER_SENT: 'order.sent',
  ORDER_UPDATED: 'order.updated',
  ORDER_STATUS_CHANGED: 'order.status_changed',
  TABLE_UPDATED: 'table.updated',
  PAYMENT_RECORDED: 'payment.recorded',
  ORDER_PAID: 'order.paid',
  PRODUCTION_ITEM_UPDATED: 'production.item.updated',
  PUBLIC_ORDER_SUBMITTED: 'public_order.submitted',
  WAITER_CALL_UPDATED: 'waiter_call.updated',
} as const;

export type AdminRealtimeEventName = (typeof ADMIN_REALTIME_EVENTS)[keyof typeof ADMIN_REALTIME_EVENTS];

export interface AdminRealtimeEventEnvelope<TPayload = Record<string, unknown>> {
  event: AdminRealtimeEventName;
  branchId: string;
  occurredAt: string;
  payload: TPayload;
}
