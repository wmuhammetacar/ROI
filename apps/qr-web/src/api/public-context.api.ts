export interface PublicUrlContext {
  branchId: string;
  tableId: string;
}

export function parsePublicUrlContext(search: string): PublicUrlContext {
  const params = new URLSearchParams(search);
  return {
    branchId: params.get('branchId')?.trim() ?? '',
    tableId: params.get('tableId')?.trim() ?? '',
  };
}

export function buildPublicContextQuery(input: { branchId?: string; tableId?: string }) {
  const params = new URLSearchParams();
  if (input.branchId?.trim()) params.set('branchId', input.branchId.trim());
  if (input.tableId?.trim()) params.set('tableId', input.tableId.trim());
  return params.toString();
}
