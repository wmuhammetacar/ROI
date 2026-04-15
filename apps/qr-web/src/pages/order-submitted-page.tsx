import { Link, useLocation } from 'react-router-dom';
import { formatCurrency } from '@roi/shared-utils';
import type { PublicOrderSubmissionResponse } from '../api';
import { usePublicContext } from '../app/public-context';

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function OrderSubmittedPage() {
  const location = useLocation();
  const { appendContext } = usePublicContext();
  const payload = location.state as PublicOrderSubmissionResponse | null;

  return (
    <div className="public-shell">
      <section className="success-card">
        <h1>Order Submitted</h1>
        <p className="muted">Your order has been sent successfully.</p>
        {payload ? (
          <div className="summary-list">
            <p>
              <strong>Order Number:</strong> {payload.orderNumber}
            </p>
            <p>
              <strong>Status:</strong> {payload.status}
            </p>
            <p>
              <strong>Service Type:</strong> {payload.serviceType}
            </p>
            <p>
              <strong>Total:</strong> {formatCurrency(Number(payload.grandTotal))}
            </p>
            <p className="muted">Created: {formatDate(payload.createdAt)}</p>
          </div>
        ) : (
          <p className="muted">Order summary is unavailable. If needed, contact staff for confirmation.</p>
        )}
        <Link to={appendContext('/menu')} className="link-button">
          Back to Menu
        </Link>
      </section>
    </div>
  );
}
