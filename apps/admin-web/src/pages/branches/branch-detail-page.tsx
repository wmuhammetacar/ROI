import { Link, useParams } from 'react-router-dom';
import { useBranchContext } from '../../app/branch-context';
import { PageHeader, SectionCard } from '../../components';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

const branchQuickLinks = [
  { to: '/dashboard', title: 'Dashboard', description: 'Operational summary view.' },
  { to: '/catalog/categories', title: 'Catalog', description: 'Manage products and modifiers.' },
  { to: '/inventory/summary', title: 'Inventory', description: 'Stock and recipe management.' },
  { to: '/finance/orders', title: 'Finance', description: 'Payments and refunds view.' },
  { to: '/reports/sales', title: 'Reports', description: 'Sales and operations reports.' },
];

export function BranchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { branches, activeBranchId, switchBranch, effectiveBranch, isViewScopeLimitedToUserBranch } = useBranchContext();

  const branch = branches.find((item) => item.id === id) ?? null;

  if (!id || !branch) {
    return (
      <section className="page-card">
        <h1>Branch Not Found</h1>
        <p className="muted">Requested branch is not available in your branch list.</p>
        <Link className="secondary branch-link-button" to="/branches">
          Back to Branches
        </Link>
      </section>
    );
  }

  const isActive = branch.id === activeBranchId;

  return (
    <div className="catalog-content">
      <PageHeader
        title={`Branch: ${branch.name}`}
        description="Branch identity and branch-scoped navigation shortcuts."
        actions={
          <div className="table-actions">
            <button type="button" className="secondary" onClick={() => void switchBranch(branch.id)} disabled={isActive}>
              {isActive ? 'Active Branch' : 'Set Active'}
            </button>
            <Link className="secondary branch-link-button" to="/branches">
              Back
            </Link>
          </div>
        }
      />

      <SectionCard title="Branch Overview" subtitle="Basic branch identity from backend branch directory.">
        <div className="detail-grid">
          <div>
            <p className="muted">Branch Name</p>
            <strong>{branch.name}</strong>
          </div>
          <div>
            <p className="muted">Branch ID</p>
            <strong>{branch.id}</strong>
          </div>
          <div>
            <p className="muted">Code</p>
            <strong>{branch.code ?? '—'}</strong>
          </div>
          <div>
            <p className="muted">Created</p>
            <strong>{formatDate(branch.createdAt)}</strong>
          </div>
          <div>
            <p className="muted">Context Status</p>
            <strong>{isActive ? 'Active' : 'Not Active'}</strong>
          </div>
          <div>
            <p className="muted">Effective Data Scope</p>
            <strong>{effectiveBranch?.name ?? '—'}</strong>
          </div>
        </div>

        {isViewScopeLimitedToUserBranch ? (
          <p className="muted">Backend currently scopes API data to your signed-in branch; this branch context is a management foundation.</p>
        ) : null}
      </SectionCard>

      <SectionCard title="Branch Shortcuts" subtitle="Jump into core operational areas with this branch as active context.">
        <div className="quick-links">
          {branchQuickLinks.map((item) => (
            <Link key={item.to} to={item.to} className="quick-link-card">
              <strong>{item.title}</strong>
              <span className="muted">{item.description}</span>
            </Link>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
