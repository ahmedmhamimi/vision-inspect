/**
 * ErrorState.tsx
 * A labeled error display with an optional retry action. Shows the specific message the
 * API returned (already sanitized to be safe for display server-side — see
 * safeErrorResponse in route.ts) rather than a generic "Something went wrong" with no
 * detail, so the reviewer knows what actually happened and what to do next.
 */
interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-tag border border-severity-high bg-severity-high-bg px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="font-body text-sm text-graphite">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="touch-target shrink-0 rounded-tag border border-severity-high bg-white px-3 py-2 font-body text-sm font-medium text-severity-high transition-colors hover:bg-severity-high hover:text-white"
        >
          Try again
        </button>
      )}
    </div>
  );
}
