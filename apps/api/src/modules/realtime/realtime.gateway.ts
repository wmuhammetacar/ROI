import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import type { AuthUser } from '../../common/interfaces/auth-user.interface';
import { PrismaService } from '../../database/prisma.service';
import { resolveRealtimeAllowedOrigins } from '../../config/runtime.config';
import { BranchScopeResolverService } from '../branches/branch-scope-resolver.service';
import { branchRoom, stationRoom } from './realtime-events.constants';
import { RealtimeEventsService } from './realtime-events.service';

interface RealtimeSocketAuth {
  token?: string;
}

interface BranchSubscribePayload {
  branchId?: string;
}

interface StationSubscribePayload {
  stationId: string;
  branchId?: string;
}

interface AuthenticatedSocket extends Socket {
  data: Socket['data'] & {
    user?: AuthUser;
    activeBranchId?: string;
  };
}

@Injectable()
@WebSocketGateway({
  namespace: 'realtime',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly allowedOrigins: Set<string>;
  private readonly nodeEnv: string;

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly branchScopeResolver: BranchScopeResolverService,
    private readonly realtimeEvents: RealtimeEventsService,
  ) {
    this.allowedOrigins = new Set(resolveRealtimeAllowedOrigins(configService));
    this.nodeEnv = configService.get<string>('NODE_ENV', 'development');
  }

  afterInit() {
    this.realtimeEvents.attachServer(this.server);
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      this.assertOriginAllowed(client);
      const token = this.extractToken(client);
      const payload = await this.jwtService.verifyAsync<AuthUser>(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });

      client.data.user = payload;
      client.data.activeBranchId = payload.branchId;
      await client.join(branchRoom(payload.branchId));
      this.logger.debug(`Socket connected user=${payload.sub} branch=${payload.branchId}`);
    } catch (error) {
      this.logger.warn(`Socket connection rejected: ${error instanceof Error ? error.message : 'unknown'}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.data.user?.sub ?? 'unknown';
    this.logger.debug(`Socket disconnected user=${userId}`);
  }

  @SubscribeMessage('subscribe.branch')
  async handleBranchSubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: BranchSubscribePayload,
  ) {
    const user = this.ensureUser(client);
    const nextBranchId = await this.branchScopeResolver.resolveReadBranchId(user, payload?.branchId);

    this.leaveBranchRooms(client);
    await client.join(branchRoom(nextBranchId));
    client.data.activeBranchId = nextBranchId;

    return {
      ok: true,
      branchId: nextBranchId,
      room: branchRoom(nextBranchId),
    };
  }

  @SubscribeMessage('subscribe.station')
  async handleStationSubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: StationSubscribePayload,
  ) {
    const user = this.ensureUser(client);
    if (!payload?.stationId?.trim()) {
      throw new ForbiddenException('stationId is required');
    }

    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, payload.branchId);
    const stationId = payload.stationId.trim();
    await this.ensureStationInBranch(branchId, stationId);

    await client.join(branchRoom(branchId));
    await client.join(stationRoom(branchId, stationId));

    return {
      ok: true,
      branchId,
      stationId,
      branchRoom: branchRoom(branchId),
      stationRoom: stationRoom(branchId, stationId),
    };
  }

  private ensureUser(client: AuthenticatedSocket): AuthUser {
    const user = client.data.user;
    if (!user) {
      throw new UnauthorizedException('Socket user context is missing');
    }
    return user;
  }

  private extractToken(client: AuthenticatedSocket): string {
    const auth = client.handshake.auth as RealtimeSocketAuth | undefined;
    const authToken = auth?.token;
    if (typeof authToken === 'string' && authToken.trim().length > 0) {
      return authToken;
    }

    const headerValue = client.handshake.headers.authorization;
    if (typeof headerValue === 'string') {
      const [scheme, token] = headerValue.split(' ');
      if (scheme?.toLowerCase() === 'bearer' && token?.trim()) {
        return token.trim();
      }
    }

    throw new UnauthorizedException('Missing realtime access token');
  }

  private async ensureStationInBranch(branchId: string, stationId: string) {
    const station = await this.prisma.station.findFirst({
      where: {
        id: stationId,
        branchId,
      },
      select: {
        id: true,
      },
    });

    if (!station) {
      throw new ForbiddenException('Station not found in selected branch');
    }
  }

  private leaveBranchRooms(client: AuthenticatedSocket) {
    for (const room of client.rooms) {
      if (room.startsWith('branch:')) {
        void client.leave(room);
      }
    }
  }

  private assertOriginAllowed(client: AuthenticatedSocket) {
    const origin = client.handshake.headers.origin;

    if (!origin) {
      if (this.nodeEnv === 'production') {
        throw new ForbiddenException('Socket origin is required in production');
      }
      return;
    }

    if (!this.allowedOrigins.has(origin)) {
      throw new ForbiddenException(`Socket origin is not allowed: ${origin}`);
    }
  }
}
