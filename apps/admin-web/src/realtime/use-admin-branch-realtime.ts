import { useEffect, useMemo, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { reportClientError } from '@roi/shared-utils';
import { adminTokenStorage } from '../api/client';
import { ADMIN_REALTIME_BASE_URL } from '../config/runtime';
import type { AdminRealtimeEventEnvelope, AdminRealtimeEventName } from './events';

type EventHandler = (event: AdminRealtimeEventEnvelope) => void;
type EventHandlerMap = Partial<Record<AdminRealtimeEventName, EventHandler>>;

export function useAdminBranchRealtime(
  branchId: string | null | undefined,
  handlers: EventHandlerMap,
) {
  const stableHandlers = useRef<EventHandlerMap>({});
  stableHandlers.current = handlers;

  const eventNames = useMemo(() => Object.keys(handlers) as AdminRealtimeEventName[], [handlers]);

  useEffect(() => {
    const token = adminTokenStorage.getToken();
    if (!token || !branchId || eventNames.length === 0) {
      return;
    }

    const socket: Socket = io(`${ADMIN_REALTIME_BASE_URL}/realtime`, {
      transports: ['websocket'],
      auth: { token },
    });

    socket.on('connect', () => {
      socket.emit('subscribe.branch', { branchId });
    });

    for (const eventName of eventNames) {
      socket.on(eventName, (event: AdminRealtimeEventEnvelope) => {
        stableHandlers.current[eventName]?.(event);
      });
    }

    socket.on('connect_error', (error) => {
      reportClientError(error, {
        app: 'admin-web',
        area: 'realtime.connect_error',
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [branchId, eventNames]);
}
