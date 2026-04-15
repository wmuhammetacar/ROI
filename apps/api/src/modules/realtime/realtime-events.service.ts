import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';
import {
  branchRoom,
  type RealtimeEventEnvelope,
  type RealtimeEventName,
  stationRoom,
} from './realtime-events.constants';

@Injectable()
export class RealtimeEventsService {
  private readonly logger = new Logger(RealtimeEventsService.name);
  private server: Server | null = null;

  attachServer(server: Server) {
    this.server = server;
    this.logger.log('Realtime gateway attached');
  }

  emitToBranch<TPayload extends Record<string, unknown>>(
    branchId: string,
    event: RealtimeEventName,
    payload: TPayload,
  ) {
    if (!this.server) {
      return;
    }

    const envelope: RealtimeEventEnvelope<TPayload> = {
      event,
      branchId,
      occurredAt: new Date().toISOString(),
      payload,
    };

    this.server.to(branchRoom(branchId)).emit(event, envelope);
  }

  emitToStation<TPayload extends Record<string, unknown>>(
    branchId: string,
    stationId: string,
    event: RealtimeEventName,
    payload: TPayload,
  ) {
    if (!this.server) {
      return;
    }

    const envelope: RealtimeEventEnvelope<TPayload> = {
      event,
      branchId,
      occurredAt: new Date().toISOString(),
      payload,
    };

    this.server.to(stationRoom(branchId, stationId)).emit(event, envelope);
  }
}

