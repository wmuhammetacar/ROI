import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { TablesController } from './tables.controller';
import { TablesService } from './tables.service';

@Module({
  imports: [AuditModule, RealtimeModule],
  controllers: [TablesController],
  providers: [TablesService],
  exports: [TablesService],
})
export class TablesModule {}
