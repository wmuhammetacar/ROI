interface DataStateProps {
  isLoading: boolean;
  error: string | null;
  empty: boolean;
  emptyMessage: string;
}

export function DataState({ isLoading, error, empty, emptyMessage }: DataStateProps) {
  if (isLoading) {
    return <p className="muted">Loading...</p>;
  }

  if (error) {
    return <p className="error">{error}</p>;
  }

  if (empty) {
    return <p className="muted">{emptyMessage}</p>;
  }

  return null;
}
