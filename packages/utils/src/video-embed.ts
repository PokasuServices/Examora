/**
 * Turns a lesson/solution video link into something a page can play:
 * YouTube and Vimeo page links become privacy-friendly embed URLs; any other
 * http(s) URL (e.g. a file uploaded to our storage) is played directly.
 */
export type VideoSource =
  { kind: "embed"; provider: "youtube" | "vimeo"; src: string } | { kind: "file"; src: string };

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function toVideoSource(url: string): VideoSource | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^www\.|^m\./, "");

  let youtubeId: string | null = null;
  if (host === "youtu.be") {
    youtubeId = u.pathname.slice(1).split("/")[0] ?? null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") youtubeId = u.searchParams.get("v");
    else {
      const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/);
      youtubeId = m?.[1] ?? null;
    }
  }
  if (youtubeId !== null) {
    return YOUTUBE_ID.test(youtubeId)
      ? {
          kind: "embed",
          provider: "youtube",
          src: `https://www.youtube-nocookie.com/embed/${youtubeId}`,
        }
      : null;
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = u.pathname.match(/(?:^|\/)(\d{6,})(?:\/|$)/);
    return m
      ? { kind: "embed", provider: "vimeo", src: `https://player.vimeo.com/video/${m[1]}` }
      : null;
  }

  return { kind: "file", src: u.toString() };
}
