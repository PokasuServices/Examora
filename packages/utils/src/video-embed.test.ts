import { describe, expect, it } from "vitest";
import { toVideoSource } from "./video-embed";

describe("toVideoSource", () => {
  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=30s",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://youtube.com/shorts/dQw4w9WgXcQ",
  ])("embeds YouTube link %s", (url) => {
    expect(toVideoSource(url)).toEqual({
      kind: "embed",
      provider: "youtube",
      src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    });
  });

  it("embeds Vimeo links", () => {
    expect(toVideoSource("https://vimeo.com/76979871")).toEqual({
      kind: "embed",
      provider: "vimeo",
      src: "https://player.vimeo.com/video/76979871",
    });
  });

  it("plays other URLs directly", () => {
    expect(toVideoSource("https://cdn.example.com/lessons/clip.mp4")).toEqual({
      kind: "file",
      src: "https://cdn.example.com/lessons/clip.mp4",
    });
  });

  it("rejects malformed YouTube ids and non-http schemes", () => {
    expect(toVideoSource("https://youtu.be/<script>")).toBeNull();
    expect(toVideoSource("javascript:alert(1)")).toBeNull();
    expect(toVideoSource("not a url")).toBeNull();
  });
});
