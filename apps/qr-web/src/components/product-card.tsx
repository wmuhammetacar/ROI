import { formatCurrency } from '@roi/shared-utils';
import type { PosCatalogProduct } from '../api';

interface ProductCardProps {
  product: PosCatalogProduct;
  onSelect: () => void;
}

export function ProductCard({ product, onSelect }: ProductCardProps) {
  return (
    <button type="button" className="product-card" onClick={onSelect}>
      <div className="product-card-header">
        <h3>{product.name}</h3>
        <strong>{formatCurrency(Number(product.basePrice))}</strong>
      </div>
      {product.description ? <p className="muted">{product.description}</p> : null}
      <div className="product-card-meta">
        {product.variants.length > 0 ? <span>{product.variants.length} variant</span> : <span>Standard</span>}
        <span>{product.modifierGroupLinks.length} modifier group</span>
      </div>
      {!product.isAvailable ? <span className="status-pill unavailable">Unavailable</span> : null}
    </button>
  );
}
