import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { buildPublicContextQuery, parsePublicUrlContext } from '../api';

export function usePublicContext() {
  const location = useLocation();

  const { branchId, tableId } = useMemo(() => parsePublicUrlContext(location.search), [location.search]);

  const queryString = useMemo(() => buildPublicContextQuery({ branchId, tableId }), [branchId, tableId]);

  const appendContext = (path: string) => {
    if (!queryString) return path;
    return `${path}?${queryString}`;
  };

  return {
    branchId,
    tableId,
    hasValidBranchContext: branchId.length > 0,
    appendContext,
    queryString,
  };
}
