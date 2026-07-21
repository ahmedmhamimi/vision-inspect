/**
 * LoadingState.tsx
 * A labeled loading indicator used across the workflow (analysis in progress, confirming,
 * generating report, loading history). Always takes an explicit label — a bare spinner
 * with no text fails the "first-time user needs no explanation" acceptance criterion.
 */
interface LoadingStateProps {
  label: string;
}

export function LoadingState({ label }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 rounded-tag border border-steel bg-white px-4 py-3"
    >
      <span
        className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-steel border-t-teal motion-reduce:animate-none"
        aria-hidden="true"
      />
      <span className="font-body text-sm text-graphite-soft">{label}</span>
    </div>
  );
}
