// Central mapping of backend error responses to safe, user-friendly messages.
// Backend implementation details (paths, stack traces, credentials) are never
// passed through — validated Pydantic messages are shown as-is since they are
// user-facing ("date must be in YYYY-MM-DD format", etc.).

function cleanValidationMessage(msg) {
  return String(msg)
    .replace(/^Value error, /i, '')
    .replace(/\s*\(type=[^)]*\)\s*/, '');
}

export function resolveApiError(err, fallback = 'Something went wrong. Please try again.') {
  const status = err?.response?.status;
  const detail = err?.response?.data?.detail;

  // Network / timeout errors (no HTTP response received)
  if (!err?.response) {
    if (err?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
    return 'Network error. Please check your connection and try again.';
  }

  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'You do not have permission to perform this action.';
  if (status === 404) return 'The requested resource was not found.';
  if (status === 409) return (
    typeof detail === 'string' && detail.trim() ? detail : 'The item already exists.'
  );
  if (status === 413) return 'The request is too large to process.';
  if (status === 429) return 'Too many requests. Please try again later.';

  if (status === 400 || status === 422) {
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0];
      if (first && typeof first.msg === 'string' && first.msg.trim()) {
        return cleanValidationMessage(first.msg);
      }
      if (first && typeof first.message === 'string' && first.message.trim()) {
        return first.message;
      }
      if (first && Array.isArray(first.loc) && first.loc.length) {
        return `${String(first.loc[first.loc.length - 1])} is invalid.`;
      }
    }
    return 'The submitted data is invalid. Please review your input and try again.';
  }

  return fallback;
}

export default resolveApiError;