export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-neutral-200"
      aria-label={`${percent}% complete`}
    >
      <div className="h-full rounded-full bg-primary-600" style={{ width: `${percent}%` }} />
    </div>
  );
}
