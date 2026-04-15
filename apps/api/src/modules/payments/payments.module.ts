import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BranchesModule } from '../branches/branches.module';
import { InventoryModule } from '../inventory/inventory.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { OrderPaymentsController } from './order-payments.controller';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RegisterShiftsController } from './register-shifts.controller';

@Module({
  imports: [AuditModule, InventoryModule, BranchesModule, RealtimeModule],
  controllers: [RegisterShiftsController, OrderPaymentsController, PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
