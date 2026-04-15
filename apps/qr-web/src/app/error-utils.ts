import { ApiError } from '@roi/api-client';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (typeof error.details === 'string') {
      return error.details;
    }

    if (isRecord(error.details)) {
      const detailMessage = error.details.message;
      if (typeof detailMessage === 'string') {
        return detailMessage;
      }
      if (Array.isArray(detailMessage)) {
        return detailMessage.filter((item): item is string => typeof item === 'string').join(', ');
      }
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unexpected error occurred.';
}
