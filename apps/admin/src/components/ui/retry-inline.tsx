/** "Couldn't load X — Retry" pattern. Mirrors apps/web's RetryInline exactly. */
export function RetryInline({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <p className="text-sm text-neutral-500">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="text-sm font-medium text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded"
      >
        Retry
      </button>
    </div>
  );
}
