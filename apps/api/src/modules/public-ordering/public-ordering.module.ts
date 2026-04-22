import { Module } from '@nestjs/common';
import { BranchesModule } from '../branches/branches.module';
import { CatalogModule } from '../catalog/catalog.module';
import { OrdersModule } from '../orders/orders.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { TableSessionsModule } from '../table-sessions/table-sessions.module';
import { WaiterCallsModule } from '../waiter-calls/waiter-calls.module';
import { PublicOrderingController } from './public-ordering.controller';
import { PublicOrderingService } from './public-ordering.service';

@Module({
  imports: [BranchesModule, CatalogModule, OrdersModule, TableSessionsModule, RealtimeModule, WaiterCallsModule],
  controllers: [PublicOrderingController],
  providers: [PublicOrderingService],
})
export class PublicOrderingModule {}
