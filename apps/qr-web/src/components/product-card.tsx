import { formatCurrency } from '@roi/shared-utils';
import type { PosCatalogProduct } from '../api';

interface ProductCardProps {
  product: PosCatalogProduct;
  onSelect: () => void;
}

export function ProductCard({ product, onSelect }: ProductCardProps) {
  const allergenPreview = product.allergenTags.slice(0, 2);

  return (
    <button type="button" className="product-card" onClick={onSelect}>
      <div className="product-card-top">
        <span className="product-card-kicker">From</span>
        <strong>{formatCurrency(Number(product.basePrice))}</strong>
      </div>
      <div className="product-card-header">
        <h3>{product.name}</h3>
      </div>
      {product.description ? <p className="muted">{product.description}</p> : null}
      {allergenPreview.length > 0 ? (
        <div className="allergen-row">
          {allergenPreview.map((tag) => (
            <span key={tag} className="allergen-chip">
              {tag}
            </span>
          ))}
          {product.allergenTags.length > 2 ? <span className="allergen-chip">+{product.allergenTags.length - 2}</span> : null}
        </div>
      ) : null}
      <div className="product-card-meta">
        {product.variants.length > 0 ? <span>{product.variants.length} variants</span> : <span>Standard</span>}
        <span>{product.modifierGroupLinks.length} modifiers</span>
      </div>
      {!product.isAvailable ? <span className="status-pill unavailable">Unavailable</span> : null}
    </button>
  );
}
