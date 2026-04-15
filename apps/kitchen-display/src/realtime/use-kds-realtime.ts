import { useEffect, useMemo, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { reportClientError } from '@roi/shared-utils';
import { kdsTokenStorage } from '../api/client';
import { KDS_REALTIME_BASE_URL } from '../config/runtime';
import type { KdsRealtimeEventEnvelope, KdsRealtimeEventName } from './events';

type EventHandler = (event: KdsRealtimeEventEnvelope) => void;
type EventHandlerMap = Partial<Record<KdsRealtimeEventName, EventHandler>>;

export function useKdsRealtime(
  branchId: string | null | undefined,
  stationId: string | null | undefined,
  handlers: EventHandlerMap,
) {
  const stableHandlers = useRef<EventHandlerMap>({});
  stableHandlers.current = handlers;

  const eventNames = useMemo(() => Object.keys(handlers) as KdsRealtimeEventName[], [handlers]);

  useEffect(() => {
    const token = kdsTokenStorage.getToken();
    if (!token || !branchId || !stationId || eventNames.length === 0) {
      return;
    }

    const socket: Socket = io(`${KDS_REALTIME_BASE_URL}/realtime`, {
      transports: ['websocket'],
      auth: { token },
    });

    socket.on('connect', () => {
      socket.emit('subscribe.station', { branchId, stationId });
    });

    for (const eventName of eventNames) {
      socket.on(eventName, (event: KdsRealtimeEventEnvelope) => {
        stableHandlers.current[eventName]?.(event);
      });
    }

    socket.on('connect_error', (error) => {
      reportClientError(error, {
        app: 'kitchen-display',
        area: 'realtime.connect_error',
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [branchId, eventNames, stationId]);
}
