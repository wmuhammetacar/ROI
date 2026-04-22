import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { TableSessionsController } from './table-sessions.controller';
import { TableSessionsService } from './table-sessions.service';

@Module({
  imports: [AuditModule, RealtimeModule],
  controllers: [TableSessionsController],
  providers: [TableSessionsService],
  exports: [TableSessionsService],
})
export class TableSessionsModule {}
