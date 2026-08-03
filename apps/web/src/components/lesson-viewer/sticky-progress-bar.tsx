/** A thin course-completion bar pinned just under the app header — real overall course progress, not a scroll-position gimmick (no scroll-tracking data exists to persist). */
export function StickyProgressBar({ percent }: { percent: number }) {
  return (
    <div
      className="sticky top-16 z-10 h-1 w-full bg-neutral-100"
      role="progressbar"
      aria-label="Course progress"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-primary-600 transition-[width] duration-300 ease-out motion-reduce:transition-none"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
