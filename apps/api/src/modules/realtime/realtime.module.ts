import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BranchesModule } from '../branches/branches.module';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeEventsService } from './realtime-events.service';

@Module({
  imports: [
    BranchesModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [RealtimeGateway, RealtimeEventsService],
  exports: [RealtimeEventsService],
})
export class RealtimeModule {}

