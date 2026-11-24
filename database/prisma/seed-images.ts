/**
 * Tiny PNG generator for sample question figures: draws a square grid where
 * filled cells are black. Lets the seed create real image questions (rotations
 * and mirror images of a pattern) without bundling binary files.
 */
import { deflateSync } from "node:zlib";

export type Pattern = boolean[][];

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Renders the pattern as a greyscale PNG: black cells, white background, grey grid lines. */
export function patternPng(pattern: Pattern, cellPx = 28): Buffer {
  const n = pattern.length;
  const pad = 6;
  const size = n * cellPx + pad * 2;
  const raw = Buffer.alloc((size + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const gx = x - pad;
      const gy = y - pad;
      let v = 255;
      if (gx >= 0 && gy >= 0 && gx < n * cellPx && gy < n * cellPx) {
        const onLine =
          gx % cellPx === 0 || gy % cellPx === 0 || gx === n * cellPx - 1 || gy === n * cellPx - 1;
        const filled = pattern[Math.floor(gy / cellPx)]![Math.floor(gx / cellPx)]!;
        v = filled ? 20 : onLine ? 150 : 255;
      }
      raw[y * (size + 1) + 1 + x] = v;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // greyscale
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export const rotate90 = (p: Pattern): Pattern =>
  p[0]!.map((_, c) => p.map((row) => row[c]!).reverse());
export const mirror = (p: Pattern): Pattern => p.map((row) => [...row].reverse());

/** An asymmetric 5×5 pattern ("P"), so every rotation and mirror image looks different. */
export const FIGURE_P: Pattern = ["11110", "10010", "11110", "10000", "10001"].map((row) =>
  [...row].map((ch) => ch === "1"),
);
