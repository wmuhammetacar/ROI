import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError } from '@roi/api-client';
import type { BranchSummary } from '../api';
import { branchesApi } from '../api';
import { setApiBranchScopeId } from '../api/branch-scope';
import { toErrorMessage } from './error-utils';
import { useAuth } from './auth-context';

const ACTIVE_BRANCH_STORAGE_KEY = 'roi_admin_active_branch_id';

interface BranchContextValue {
  branches: BranchSummary[];
  isLoadingBranches: boolean;
  branchesError: string | null;
  isSwitchingBranch: boolean;
  supportsServerBranchOverride: boolean;
  userBranchId: string | null;
  activeBranchId: string | null;
  activeBranch: BranchSummary | null;
  effectiveBranchId: string | null;
  effectiveBranch: BranchSummary | null;
  isViewScopeLimitedToUserBranch: boolean;
  scopeNote: string;
  switchBranch: (branchId: string) => Promise<void>;
  refreshBranches: () => Promise<void>;
}

const BranchContext = createContext<BranchContextValue | undefined>(undefined);

function readPersistedBranchId() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACTIVE_BRANCH_STORAGE_KEY);
}

function persistBranchId(branchId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACTIVE_BRANCH_STORAGE_KEY, branchId);
}

export function BranchProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [branchesError, setBranchesError] = useState<string | null>(null);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(() => readPersistedBranchId());
  const [isSwitchingBranch, setIsSwitchingBranch] = useState(false);

  const userBranchId = user?.branchId ?? null;
  const supportsServerBranchOverride = user?.roles.includes('admin') ?? false;

  const chooseFallbackBranchId = useCallback(
    (items: BranchSummary[]) => {
      if (items.length === 0) {
        return userBranchId;
      }

      const persisted = readPersistedBranchId();
      if (persisted && items.some((item) => item.id === persisted)) {
        return persisted;
      }

      if (userBranchId && items.some((item) => item.id === userBranchId)) {
        return userBranchId;
      }

      return items[0]?.id ?? userBranchId;
    },
    [userBranchId],
  );

  const loadBranches = useCallback(async () => {
    if (!user) {
      setBranches([]);
      setBranchesError(null);
      setIsLoadingBranches(false);
      setActiveBranchId(null);
      return;
    }

    setIsLoadingBranches(true);
    setBranchesError(null);

    try {
      const data = await branchesApi.list();
      setBranches(data);
      setActiveBranchId((current) => {
        if (current && data.some((item) => item.id === current)) {
          return current;
        }

        const next = chooseFallbackBranchId(data);
        if (next) {
          persistBranchId(next);
        }
        return next;
      });
    } catch (err) {
      setBranchesError(toErrorMessage(err));
      setBranches([]);
      setActiveBranchId(userBranchId);
    } finally {
      setIsLoadingBranches(false);
    }
  }, [chooseFallbackBranchId, user, userBranchId]);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  const refreshBranches = useCallback(async () => {
    await loadBranches();
  }, [loadBranches]);

  const switchBranch = useCallback(
    async (branchId: string) => {
      if (!branchId) return;
      if (!branches.some((item) => item.id === branchId)) {
        setBranchesError('Selected branch is not available in current branch list.');
        return;
      }

      setIsSwitchingBranch(true);
      setBranchesError(null);
      setActiveBranchId(branchId);
      persistBranchId(branchId);
      setIsSwitchingBranch(false);
    },
    [branches],
  );

  const activeBranch = useMemo(() => branches.find((item) => item.id === activeBranchId) ?? null, [activeBranchId, branches]);

  const effectiveBranchId = supportsServerBranchOverride ? activeBranchId : userBranchId;
  const effectiveBranch = useMemo(
    () => branches.find((item) => item.id === effectiveBranchId) ?? activeBranch,
    [activeBranch, branches, effectiveBranchId],
  );

  const isViewScopeLimitedToUserBranch = !supportsServerBranchOverride;

  const scopeNote = isViewScopeLimitedToUserBranch
    ? 'Data APIs are currently scoped to your signed-in branch by backend policy.'
    : 'Views are scoped to selected active branch.';

  useEffect(() => {
    setApiBranchScopeId(effectiveBranchId);
  }, [effectiveBranchId]);

  const value = useMemo<BranchContextValue>(
    () => ({
      branches,
      isLoadingBranches,
      branchesError,
      isSwitchingBranch,
      supportsServerBranchOverride,
      userBranchId,
      activeBranchId,
      activeBranch,
      effectiveBranchId,
      effectiveBranch,
      isViewScopeLimitedToUserBranch,
      scopeNote,
      switchBranch,
      refreshBranches,
    }),
    [
      activeBranch,
      activeBranchId,
      branches,
      branchesError,
      effectiveBranch,
      effectiveBranchId,
      isLoadingBranches,
      isSwitchingBranch,
      isViewScopeLimitedToUserBranch,
      refreshBranches,
      scopeNote,
      supportsServerBranchOverride,
      switchBranch,
      userBranchId,
    ],
  );

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useBranchContext(): BranchContextValue {
  const context = useContext(BranchContext);

  if (!context) {
    throw new ApiError({ status: 500, message: 'Branch context is unavailable' });
  }

  return context;
}
