import { cn } from "@examora/ui";
import { mediaUrl } from "@/lib/media";

/** An image from question/option/explanation content (uploaded media or an https URL). */
export function StudyImage({
  src,
  alt,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const url = mediaUrl(src);
  if (!url) return null;
  return (
    // Plain <img>: media URLs redirect to short-lived storage URLs, which next/image can't optimise.
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className={cn("max-h-[420px] max-w-full rounded-md object-contain", className)}
    />
  );
}
