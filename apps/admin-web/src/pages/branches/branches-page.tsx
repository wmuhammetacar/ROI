import { Link } from 'react-router-dom';
import { useBranchContext } from '../../app/branch-context';
import { DataState, PageHeader, SectionCard } from '../../components';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function BranchesPage() {
  const {
    branches,
    isLoadingBranches,
    branchesError,
    activeBranchId,
    switchBranch,
    refreshBranches,
    effectiveBranch,
    isViewScopeLimitedToUserBranch,
  } = useBranchContext();

  return (
    <div className="catalog-content">
      <PageHeader
        title="Branches"
        description="List operational branches and set active branch context for admin navigation."
        actions={
          <button type="button" className="secondary" onClick={() => void refreshBranches()}>
            Refresh
          </button>
        }
      />

      <DataState
        isLoading={isLoadingBranches}
        error={branchesError}
        empty={!isLoadingBranches && !branchesError && branches.length === 0}
        emptyMessage="No branches found."
      />

      {!isLoadingBranches && branches.length > 0 ? (
        <SectionCard
          title="Branch Directory"
          subtitle={
            isViewScopeLimitedToUserBranch
              ? `Data APIs are currently scoped to ${effectiveBranch?.name ?? 'your signed-in branch'}.`
              : 'Data APIs follow selected active branch.'
          }
        >
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Branch ID</th>
                  <th>Code</th>
                  <th>Created</th>
                  <th>Context</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((branch) => {
                  const isActive = branch.id === activeBranchId;

                  return (
                    <tr key={branch.id} className={isActive ? 'active-row' : ''}>
                      <td>
                        <strong>{branch.name}</strong>
                      </td>
                      <td>{branch.id}</td>
                      <td>{branch.code ?? '—'}</td>
                      <td>{formatDate(branch.createdAt)}</td>
                      <td>{isActive ? <span className="pill online">Active</span> : <span className="pill">Available</span>}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => void switchBranch(branch.id)}
                            disabled={isActive}
                          >
                            {isActive ? 'Selected' : 'Set Active'}
                          </button>
                          <Link className="secondary branch-link-button" to={`/branches/${branch.id}`}>
                            Open
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
