import { useEffect, useMemo, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { reportClientError } from '@roi/shared-utils';
import { posTokenStorage } from '../api/client';
import { POS_REALTIME_BASE_URL } from '../config/runtime';
import type { PosRealtimeEventEnvelope, PosRealtimeEventName } from './events';

type EventHandler = (event: PosRealtimeEventEnvelope) => void;
type EventHandlerMap = Partial<Record<PosRealtimeEventName, EventHandler>>;

export function usePosBranchRealtime(branchId: string | null | undefined, handlers: EventHandlerMap) {
  const stableHandlers = useRef<EventHandlerMap>({});
  stableHandlers.current = handlers;

  const eventNames = useMemo(() => Object.keys(handlers) as PosRealtimeEventName[], [handlers]);

  useEffect(() => {
    const token = posTokenStorage.getToken();
    if (!token || !branchId || eventNames.length === 0) {
      return;
    }

    const socket: Socket = io(`${POS_REALTIME_BASE_URL}/realtime`, {
      transports: ['websocket'],
      auth: { token },
    });

    socket.on('connect', () => {
      socket.emit('subscribe.branch', { branchId });
    });

    for (const eventName of eventNames) {
      socket.on(eventName, (event: PosRealtimeEventEnvelope) => {
        stableHandlers.current[eventName]?.(event);
      });
    }

    socket.on('connect_error', (error) => {
      reportClientError(error, {
        app: 'pos-web',
        area: 'realtime.connect_error',
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [branchId, eventNames]);
}
