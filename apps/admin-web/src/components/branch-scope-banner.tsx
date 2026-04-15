import { useBranchContext } from '../app/branch-context';

interface BranchScopeBannerProps {
  sectionLabel: string;
}

export function BranchScopeBanner({ sectionLabel }: BranchScopeBannerProps) {
  const {
    activeBranch,
    effectiveBranch,
    isViewScopeLimitedToUserBranch,
    scopeNote,
    activeBranchId,
    effectiveBranchId,
  } = useBranchContext();

  if (!activeBranch && !effectiveBranch) {
    return null;
  }

  const isMismatchedScope =
    isViewScopeLimitedToUserBranch &&
    activeBranchId !== null &&
    effectiveBranchId !== null &&
    activeBranchId !== effectiveBranchId;

  return (
    <div className={`branch-scope-banner ${isMismatchedScope ? 'warning' : ''}`}>
      <strong>{sectionLabel} Scope</strong>
      <span className="muted">
        Active branch: {activeBranch?.name ?? '—'} | Effective data branch: {effectiveBranch?.name ?? '—'}
      </span>
      <span className="muted">{scopeNote}</span>
    </div>
  );
}
