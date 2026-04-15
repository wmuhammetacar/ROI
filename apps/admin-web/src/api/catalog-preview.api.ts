import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import { appendBranchScope, withQuery } from './branch-scope';
import type { PosPreviewResponse } from './catalog-types';

export interface PosPreviewQuery {
  includeInactive?: boolean;
  includeUnavailable?: boolean;
}

function toBooleanString(value: boolean | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value ? 'true' : 'false';
}

export function createCatalogPreviewApi(client: ApiClient) {
  return {
    getPosProducts(query: PosPreviewQuery = {}, branchId?: string) {
      const includeInactive = toBooleanString(query.includeInactive);
      const includeUnavailable = toBooleanString(query.includeUnavailable);
      const params = appendBranchScope(undefined, branchId);

      if (includeInactive) {
        params.set('includeInactive', includeInactive);
      }

      if (includeUnavailable) {
        params.set('includeUnavailable', includeUnavailable);
      }

      return client.get<PosPreviewResponse>(withQuery('/catalog/pos-products', params));
    },
  };
}

export const catalogPreviewApi = createCatalogPreviewApi(adminApiClient);
