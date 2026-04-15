import { useEffect, useState } from 'react';
import { formatCurrency } from '@roi/shared-utils';
import { catalogPreviewApi } from '../../api/catalog-preview.api';
import type { PosPreviewResponse } from '../../api/catalog-types';
import { toErrorMessage } from '../../app/error-utils';
import { DataState, PageHeader, SectionCard, StatusBadge } from '../../components';

export function PosPreviewPage() {
  const [data, setData] = useState<PosPreviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [includeUnavailable, setIncludeUnavailable] = useState(false);

  const loadPreview = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await catalogPreviewApi.getPosProducts({
        includeInactive,
        includeUnavailable,
      });
      setData(response);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPreview();
  }, [includeInactive, includeUnavailable]);

  return (
    <div className="catalog-content">
      <PageHeader
        title="POS Preview"
        description="Review the exact payload that POS clients will receive."
      />

      <SectionCard>
        <div className="table-toolbar">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
            />
            Include inactive items
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={includeUnavailable}
              onChange={(event) => setIncludeUnavailable(event.target.checked)}
            />
            Include unavailable products
          </label>
        </div>
        <DataState
          isLoading={isLoading}
          error={error}
          empty={!isLoading && data?.categories?.length === 0}
          emptyMessage="No products found for the current filters."
        />

        {!isLoading && data ? (
          <div className="preview-grid">
            {data.categories.map((category) => (
              <div key={category.id} className="preview-category">
                <header>
                  <h3>{category.name}</h3>
                  <StatusBadge active={category.isActive} />
                </header>
                <p className="muted">{category.description ?? 'No description'}</p>
                <div className="preview-products">
                  {category.products.map((product) => (
                    <div key={product.id} className="preview-product">
                      <div className="preview-product-header">
                        <div>
                          <strong>{product.name}</strong>
                          <p className="muted">{product.sku ?? 'No SKU'} • {product.productType}</p>
                        </div>
                        <div className="badge-row">
                          <StatusBadge active={product.isActive} />
                          <StatusBadge
                            active={product.isAvailable}
                            activeLabel="Available"
                            inactiveLabel="Unavailable"
                          />
                        </div>
                      </div>
                      <p className="muted">{product.description ?? 'No description'}</p>
                      <p className="preview-price">Base: {formatCurrency(product.basePrice)}</p>

                      {product.variants.length > 0 ? (
                        <div className="preview-block">
                          <strong>Variants</strong>
                          <ul>
                            {product.variants.map((variant) => (
                              <li key={variant.id}>
                                {variant.name} ({formatCurrency(variant.priceDelta)})
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {product.modifierGroupLinks.length > 0 ? (
                        <div className="preview-block">
                          <strong>Modifier Groups</strong>
                          {product.modifierGroupLinks.map((link) => {
                            if (!link.modifierGroup) {
                              return null;
                            }

                            return (
                              <div key={link.id} className="preview-modifier">
                                <div className="preview-modifier-header">
                                  <span>{link.modifierGroup.name}</span>
                                  <span className="muted">
                                    {link.modifierGroup.selectionType} • min {link.modifierGroup.minSelect} / max{' '}
                                    {link.modifierGroup.maxSelect}
                                  </span>
                                </div>
                                <ul>
                                  {link.modifierGroup.options?.map((option) => (
                                    <li key={option.id}>
                                      {option.name} ({formatCurrency(option.priceDelta)})
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}

                      {product.priceOverrides.length > 0 ? (
                        <div className="preview-block">
                          <strong>Branch Overrides</strong>
                          <ul>
                            {product.priceOverrides.map((override) => (
                              <li key={override.id}>
                                {override.variant?.name ?? 'Base'}: {formatCurrency(override.price)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}
