import { Injectable } from '@nestjs/common';
import { IntegrationAdapter } from './adapters/integration-adapter.interface';
import { MockMarketplaceAdapter } from './adapters/mock-marketplace.adapter';

@Injectable()
export class IntegrationAdapterRegistry {
  private readonly adaptersByCode: Map<string, IntegrationAdapter>;

  constructor(private readonly mockMarketplaceAdapter: MockMarketplaceAdapter) {
    this.adaptersByCode = new Map<string, IntegrationAdapter>([
      [this.mockMarketplaceAdapter.code.toUpperCase(), this.mockMarketplaceAdapter],
    ]);
  }

  getAdapterByProviderCode(providerCode: string): IntegrationAdapter | null {
    return this.adaptersByCode.get(providerCode.trim().toUpperCase()) ?? null;
  }
}
