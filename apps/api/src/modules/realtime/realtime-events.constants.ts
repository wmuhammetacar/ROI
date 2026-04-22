export const REALTIME_EVENTS = {
  ORDER_CREATED: 'order.created',
  ORDER_SENT: 'order.sent',
  ORDER_UPDATED: 'order.updated',
  ORDER_SENT_TO_STATION: 'order.sent_to_station',
  ORDER_STATUS_CHANGED: 'order.status_changed',
  TABLE_UPDATED: 'table.updated',
  PRODUCTION_TICKET_CREATED: 'production.ticket.created',
  PRODUCTION_ITEM_UPDATED: 'production.item.updated',
  PAYMENT_RECORDED: 'payment.recorded',
  ORDER_PAID: 'order.paid',
  PUBLIC_ORDER_SUBMITTED: 'public_order.submitted',
  WAITER_CALL_UPDATED: 'waiter_call.updated',
} as const;

export type RealtimeEventName = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

export interface RealtimeEventEnvelope<TPayload = Record<string, unknown>> {
  event: RealtimeEventName;
  branchId: string;
  occurredAt: string;
  payload: TPayload;
}

export function branchRoom(branchId: string) {
  return `branch:${branchId}`;
}

export function stationRoom(branchId: string, stationId: string) {
  return `station:${branchId}:${stationId}`;
}
