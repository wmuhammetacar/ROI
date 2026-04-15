import { useMemo } from 'react';
import { useBranchContext } from '../app/branch-context';

export function BranchSwitcher() {
  const {
    branches,
    activeBranchId,
    isLoadingBranches,
    isSwitchingBranch,
    branchesError,
    supportsServerBranchOverride,
    switchBranch,
    refreshBranches,
  } = useBranchContext();

  const isDisabled = isLoadingBranches || isSwitchingBranch || branches.length === 0 || !supportsServerBranchOverride;

  const helperText = useMemo(() => {
    if (branchesError) return `Branches unavailable: ${branchesError}`;
    if (isLoadingBranches) return 'Loading branches...';
    if (branches.length === 0) return 'No branch records available.';
    if (!supportsServerBranchOverride) return 'Branch switching is limited to admin users.';
    if (isSwitchingBranch) return 'Switching active branch...';
    return null;
  }, [branches.length, branchesError, isLoadingBranches, isSwitchingBranch, supportsServerBranchOverride]);

  return (
    <div className="branch-switcher">
      <label htmlFor="branch-switcher-select" className="muted">
        Branch
      </label>
      <select
        id="branch-switcher-select"
        value={activeBranchId ?? ''}
        onChange={(event) => {
          void switchBranch(event.target.value);
        }}
        disabled={isDisabled}
      >
        {branches.length === 0 ? <option value="">No branches</option> : null}
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
      <button type="button" className="secondary" onClick={() => void refreshBranches()} disabled={isLoadingBranches}>
        Refresh
      </button>
      {helperText ? <span className="muted">{helperText}</span> : null}
    </div>
  );
}
