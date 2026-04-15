let activeBranchScopeId: string | null = null;

function normalizeBranchId(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function setApiBranchScopeId(branchId?: string | null) {
  activeBranchScopeId = normalizeBranchId(branchId);
}

export function getApiBranchScopeId() {
  return activeBranchScopeId;
}

export function appendBranchScope(params?: URLSearchParams, branchId?: string | null) {
  const searchParams = params ?? new URLSearchParams();
  const effectiveBranchId = normalizeBranchId(branchId) ?? activeBranchScopeId;

  if (effectiveBranchId) {
    searchParams.set('branchId', effectiveBranchId);
  }

  return searchParams;
}

export function withQuery(path: string, params?: URLSearchParams) {
  const suffix = params?.toString() ?? '';
  return suffix ? `${path}?${suffix}` : path;
}
