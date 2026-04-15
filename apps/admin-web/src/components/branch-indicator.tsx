import { useBranchContext } from '../app/branch-context';

export function BranchIndicator() {
  const { activeBranch, effectiveBranch, isViewScopeLimitedToUserBranch } = useBranchContext();

  if (!activeBranch && !effectiveBranch) {
    return <span className="muted">Branch: unavailable</span>;
  }

  const activeLabel = activeBranch?.name ?? 'Unknown';
  const effectiveLabel = effectiveBranch?.name ?? activeLabel;

  return (
    <div className="branch-indicator">
      <span className="pill">Active: {activeLabel}</span>
      {isViewScopeLimitedToUserBranch && activeLabel !== effectiveLabel ? (
        <span className="pill checking">Data Scope: {effectiveLabel}</span>
      ) : null}
    </div>
  );
}
