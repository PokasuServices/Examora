import { toVideoSource } from "@examora/utils";

/** Plays a YouTube/Vimeo link as an embed, or any other video URL (e.g. an uploaded file) natively. */
export function VideoPlayer({ url, title }: { url: string; title: string }) {
  const source = toVideoSource(url);
  if (!source) {
    return (
      <p className="rounded-md bg-neutral-100 px-4 py-6 text-center text-sm text-neutral-500 dark:bg-white/5 dark:text-neutral-400">
        This video link can&rsquo;t be played.
      </p>
    );
  }
  return (
    <div className="aspect-video w-full overflow-hidden rounded-md bg-neutral-900">
      {source.kind === "embed" ? (
        <iframe
          src={source.src}
          title={title}
          className="h-full w-full"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <video src={source.src} controls preload="metadata" className="h-full w-full">
          <track kind="captions" />
        </video>
      )}
    </div>
  );
}
