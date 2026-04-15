import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BranchesModule } from '../branches/branches.module';
import { OrdersModule } from '../orders/orders.module';
import { IntegrationAdapterRegistry } from './integration-adapter.registry';
import { MockMarketplaceAdapter } from './adapters/mock-marketplace.adapter';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';

@Module({
  imports: [AuditModule, BranchesModule, OrdersModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, IntegrationAdapterRegistry, MockMarketplaceAdapter],
})
export class IntegrationsModule {}
