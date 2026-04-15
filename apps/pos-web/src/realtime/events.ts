export const POS_REALTIME_EVENTS = {
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_SENT_TO_STATION: 'order.sent_to_station',
  ORDER_STATUS_CHANGED: 'order.status_changed',
  PRODUCTION_TICKET_CREATED: 'production.ticket.created',
  PRODUCTION_ITEM_UPDATED: 'production.item.updated',
  PAYMENT_RECORDED: 'payment.recorded',
  ORDER_PAID: 'order.paid',
  PUBLIC_ORDER_SUBMITTED: 'public_order.submitted',
} as const;

export type PosRealtimeEventName = (typeof POS_REALTIME_EVENTS)[keyof typeof POS_REALTIME_EVENTS];

export interface PosRealtimeEventEnvelope<TPayload = Record<string, unknown>> {
  event: PosRealtimeEventName;
  branchId: string;
  occurredAt: string;
  payload: TPayload;
}

