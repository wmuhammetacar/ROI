import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { BranchesModule } from '../branches/branches.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { WaiterCallsController } from './waiter-calls.controller';
import { WaiterCallsService } from './waiter-calls.service';

@Module({
  imports: [PrismaModule, AuditModule, BranchesModule, RealtimeModule],
  controllers: [WaiterCallsController],
  providers: [WaiterCallsService],
  exports: [WaiterCallsService],
})
export class WaiterCallsModule {}
