import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ProductionTicketItemsController } from './production-ticket-items.controller';
import { ProductionTicketsController } from './production-tickets.controller';
import { ProductionOrdersController } from './production-orders.controller';
import { ProductionService } from './production.service';
import { StationProductionController } from './station-production.controller';

@Module({
  imports: [AuditModule, RealtimeModule],
  controllers: [
    ProductionOrdersController,
    ProductionTicketsController,
    ProductionTicketItemsController,
    StationProductionController,
  ],
  providers: [ProductionService],
  exports: [ProductionService],
})
export class ProductionModule {}
