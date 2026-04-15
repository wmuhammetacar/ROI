import type { ReactNode } from 'react';
import { useBranchContext } from '../app/branch-context';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  const { activeBranch, effectiveBranch, isViewScopeLimitedToUserBranch } = useBranchContext();

  const activeLabel = activeBranch?.name ?? '—';
  const effectiveLabel = effectiveBranch?.name ?? activeLabel;

  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description ? <p className="muted">{description}</p> : null}
        <p className="muted page-branch-line">
          Active branch: <strong>{activeLabel}</strong> | Data scope: <strong>{effectiveLabel}</strong>
          {isViewScopeLimitedToUserBranch && activeLabel !== effectiveLabel ? ' (backend currently uses signed-in branch scope)' : ''}
        </p>
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>
  );
}
