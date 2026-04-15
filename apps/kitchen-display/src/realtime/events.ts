export const KDS_REALTIME_EVENTS = {
  PRODUCTION_TICKET_CREATED: 'production.ticket.created',
  PRODUCTION_ITEM_UPDATED: 'production.item.updated',
  ORDER_SENT_TO_STATION: 'order.sent_to_station',
  PUBLIC_ORDER_SUBMITTED: 'public_order.submitted',
} as const;

export type KdsRealtimeEventName = (typeof KDS_REALTIME_EVENTS)[keyof typeof KDS_REALTIME_EVENTS];

export interface KdsRealtimeEventEnvelope<TPayload = Record<string, unknown>> {
  event: KdsRealtimeEventName;
  branchId: string;
  occurredAt: string;
  payload: TPayload;
}

