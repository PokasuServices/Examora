/**
 * Simple SVG diagrams for sample explanations (clocks, folds, cubes,
 * perspective, colour wheel…). Original artwork, generated in code.
 */

const FONT = "Arial, Helvetica, sans-serif";
const INK = "#1e293b";
const MUTED = "#64748b";
const ACCENT = "#2563eb";
const WARN = "#d97706";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function frame(inner: string, caption: string, title?: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300" viewBox="0 0 480 300">
<rect width="480" height="300" rx="12" fill="#ffffff" stroke="#e2e8f0"/>
${title ? `<text x="20" y="30" font-family="${FONT}" font-size="15" font-weight="bold" fill="${ACCENT}">${esc(title)}</text>` : ""}
${inner}
<text x="240" y="284" text-anchor="middle" font-family="${FONT}" font-size="14" fill="${INK}">${esc(caption)}</text>
</svg>`;
}

const pt = (cx: number, cy: number, len: number, deg: number) => {
  const r = (deg * Math.PI) / 180;
  return [cx + len * Math.sin(r), cy - len * Math.cos(r)] as const;
};

/** A clock face; optional arc highlighting the angle between the hands. */
export function clockSvg(h: number, m: number, caption: string, title?: string, showArc = true) {
  const cx = 240;
  const cy = 145;
  const R = 95;
  const hourDeg = (h % 12) * 30 + m * 0.5;
  const minDeg = m * 6;
  let ticks = "";
  for (let i = 0; i < 12; i++) {
    const [x1, y1] = pt(cx, cy, R - 8, i * 30);
    const [x2, y2] = pt(cx, cy, R, i * 30);
    ticks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK}" stroke-width="${i % 3 === 0 ? 3 : 1.5}"/>`;
  }
  const nums = [
    [12, 0],
    [3, 90],
    [6, 180],
    [9, 270],
  ]
    .map(([n, d]) => {
      const [x, y] = pt(cx, cy, R - 24, d!);
      return `<text x="${x}" y="${y + 5}" text-anchor="middle" font-family="${FONT}" font-size="14" fill="${MUTED}">${n}</text>`;
    })
    .join("");
  const [hx, hy] = pt(cx, cy, 52, hourDeg);
  const [mx, my] = pt(cx, cy, 80, minDeg);
  let arc = "";
  if (showArc) {
    const a = Math.min(hourDeg, minDeg);
    const b = Math.max(hourDeg, minDeg);
    const sweep = b - a <= 180 ? [a, b] : [b, a + 360];
    const [sx, sy] = pt(cx, cy, 34, sweep[0]!);
    const [ex, ey] = pt(cx, cy, 34, sweep[1]!);
    const large = sweep[1]! - sweep[0]! > 180 ? 1 : 0;
    arc = `<path d="M ${sx} ${sy} A 34 34 0 ${large} 1 ${ex} ${ey}" fill="none" stroke="${WARN}" stroke-width="4"/>`;
  }
  return frame(
    `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#f8fafc" stroke="${INK}" stroke-width="3"/>${ticks}${nums}${arc}
<line x1="${cx}" y1="${cy}" x2="${hx}" y2="${hy}" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
<line x1="${cx}" y1="${cy}" x2="${mx}" y2="${my}" stroke="${ACCENT}" stroke-width="4" stroke-linecap="round"/>
<circle cx="${cx}" cy="${cy}" r="5" fill="${INK}"/>`,
    caption,
    title,
  );
}

/** A worked-steps card: a heading and a few lines of working. */
export function workingSvg(title: string, lines: string[], caption: string) {
  const body = lines
    .map(
      (l, i) =>
        `<text x="40" y="${80 + i * 34}" font-family="${FONT}" font-size="${i === lines.length - 1 ? 20 : 18}" ${i === lines.length - 1 ? `font-weight="bold" fill="${ACCENT}"` : `fill="${INK}"`}>${esc(l)}</text>`,
    )
    .join("");
  return frame(body, caption, title);
}

/** Folding a square in half, punching one hole, unfolding. step 1..3 */
export function paperFoldSvg(step: 1 | 2 | 3, caption: string) {
  let inner = "";
  if (step === 1) {
    inner = `<rect x="160" y="60" width="160" height="160" fill="#eff6ff" stroke="${INK}" stroke-width="2"/>
<line x1="240" y1="52" x2="240" y2="228" stroke="${WARN}" stroke-width="2" stroke-dasharray="8 6"/>
<path d="M 300 140 q -40 -50 -80 0" fill="none" stroke="${ACCENT}" stroke-width="3" marker-end="url(#a)"/>`;
  } else if (step === 2) {
    inner = `<rect x="200" y="60" width="80" height="160" fill="#dbeafe" stroke="${INK}" stroke-width="2"/>
<circle cx="250" cy="120" r="10" fill="#ffffff" stroke="${INK}" stroke-width="2"/>
<text x="300" y="125" font-family="${FONT}" font-size="14" fill="${MUTED}">punch through 2 layers</text>`;
  } else {
    inner = `<rect x="160" y="60" width="160" height="160" fill="#eff6ff" stroke="${INK}" stroke-width="2"/>
<line x1="240" y1="60" x2="240" y2="220" stroke="${MUTED}" stroke-width="1.5" stroke-dasharray="6 6"/>
<circle cx="250" cy="120" r="10" fill="#ffffff" stroke="${INK}" stroke-width="2"/>
<circle cx="230" cy="120" r="10" fill="#ffffff" stroke="${INK}" stroke-width="2"/>`;
  }
  return frame(
    `<defs><marker id="a" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="${ACCENT}"/></marker></defs>${inner}`,
    caption,
    `Step ${step}`,
  );
}

/** Walk diagram: north then east, with the straight-line distance. */
export function walkSvg(caption: string) {
  return frame(
    `<defs><marker id="b" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="${INK}"/></marker></defs>
<circle cx="150" cy="230" r="6" fill="${INK}"/><text x="120" y="252" font-family="${FONT}" font-size="14" fill="${INK}">Start</text>
<line x1="150" y1="230" x2="150" y2="80" stroke="${INK}" stroke-width="3" marker-end="url(#b)"/>
<text x="110" y="160" font-family="${FONT}" font-size="15" fill="${INK}">4 km</text>
<line x1="150" y1="72" x2="350" y2="72" stroke="${INK}" stroke-width="3" marker-end="url(#b)"/>
<text x="235" y="62" font-family="${FONT}" font-size="15" fill="${INK}">3 km</text>
<line x1="150" y1="230" x2="356" y2="72" stroke="${WARN}" stroke-width="3" stroke-dasharray="8 6"/>
<text x="268" y="170" font-family="${FONT}" font-size="16" font-weight="bold" fill="${WARN}">5 km</text>
<text x="400" y="60" font-family="${FONT}" font-size="14" fill="${MUTED}">N ↑</text>`,
    caption,
  );
}

/** A rectangle with its diagonal labelled. */
export function diagonalSvg(caption: string) {
  return frame(
    `<rect x="110" y="80" width="260" height="120" fill="#eff6ff" stroke="${INK}" stroke-width="2"/>
<line x1="110" y1="200" x2="370" y2="80" stroke="${WARN}" stroke-width="3"/>
<text x="230" y="222" font-family="${FONT}" font-size="15" fill="${INK}">12 cm</text>
<text x="380" y="145" font-family="${FONT}" font-size="15" fill="${INK}">5 cm</text>
<text x="215" y="130" font-family="${FONT}" font-size="16" font-weight="bold" fill="${WARN}">d = 13 cm</text>`,
    caption,
  );
}

/** A circle with its radius drawn. */
export function circleSvg(caption: string, label = "r = 7 cm") {
  return frame(
    `<circle cx="240" cy="140" r="100" fill="#eff6ff" stroke="${INK}" stroke-width="2"/>
<line x1="240" y1="140" x2="340" y2="140" stroke="${WARN}" stroke-width="3"/>
<circle cx="240" cy="140" r="4" fill="${INK}"/>
<text x="262" y="132" font-family="${FONT}" font-size="16" font-weight="bold" fill="${WARN}">${esc(label)}</text>`,
    caption,
  );
}

/** Front face of a 3×3×3 painted cube; edge-middle cubes highlighted. */
export function cubeSvg(caption: string, highlight: "edges" | "corners" | "centres") {
  let cells = "";
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const corner = (r === 0 || r === 2) && (c === 0 || c === 2);
      const centre = r === 1 && c === 1;
      const edge = !corner && !centre;
      const on =
        (highlight === "edges" && edge) ||
        (highlight === "corners" && corner) ||
        (highlight === "centres" && centre);
      cells += `<rect x="${165 + c * 50}" y="${60 + r * 50}" width="50" height="50" fill="${on ? "#fde68a" : "#f1f5f9"}" stroke="${INK}" stroke-width="2"/>`;
    }
  }
  return frame(cells, caption);
}

/** One- or two-point perspective construction. */
export function perspectiveSvg(points: 1 | 2, caption: string) {
  if (points === 1) {
    return frame(
      `<line x1="20" y1="110" x2="460" y2="110" stroke="${MUTED}" stroke-width="1.5"/>
<text x="24" y="102" font-family="${FONT}" font-size="12" fill="${MUTED}">horizon</text>
<circle cx="240" cy="110" r="5" fill="${WARN}"/><text x="250" y="102" font-family="${FONT}" font-size="13" fill="${WARN}">VP</text>
<rect x="150" y="150" width="180" height="90" fill="#eff6ff" stroke="${INK}" stroke-width="2"/>
<line x1="150" y1="150" x2="240" y2="110" stroke="${ACCENT}" stroke-dasharray="6 5"/>
<line x1="330" y1="150" x2="240" y2="110" stroke="${ACCENT}" stroke-dasharray="6 5"/>
<line x1="150" y1="240" x2="240" y2="110" stroke="${ACCENT}" stroke-dasharray="6 5"/>
<line x1="330" y1="240" x2="240" y2="110" stroke="${ACCENT}" stroke-dasharray="6 5"/>`,
      caption,
    );
  }
  return frame(
    `<line x1="10" y1="100" x2="470" y2="100" stroke="${MUTED}" stroke-width="1.5"/>
<circle cx="30" cy="100" r="5" fill="${WARN}"/><circle cx="450" cy="100" r="5" fill="${WARN}"/>
<text x="20" y="90" font-family="${FONT}" font-size="13" fill="${WARN}">VP1</text><text x="430" y="90" font-family="${FONT}" font-size="13" fill="${WARN}">VP2</text>
<line x1="230" y1="70" x2="230" y2="250" stroke="${INK}" stroke-width="3"/>
<line x1="230" y1="70" x2="30" y2="100" stroke="${ACCENT}" stroke-dasharray="6 5"/>
<line x1="230" y1="250" x2="30" y2="100" stroke="${ACCENT}" stroke-dasharray="6 5"/>
<line x1="230" y1="70" x2="450" y2="100" stroke="${ACCENT}" stroke-dasharray="6 5"/>
<line x1="230" y1="250" x2="450" y2="100" stroke="${ACCENT}" stroke-dasharray="6 5"/>
<line x1="140" y1="84" x2="140" y2="183" stroke="${INK}" stroke-width="2"/>
<line x1="330" y1="84" x2="330" y2="182" stroke="${INK}" stroke-width="2"/>`,
    caption,
  );
}

/** RYB colour wheel; `highlight` names segments to emphasise. */
export function colourWheelSvg(caption: string, highlight: string[] = []) {
  const segs = [
    ["Red", "#dc2626"],
    ["Orange", "#f97316"],
    ["Yellow", "#facc15"],
    ["Green", "#16a34a"],
    ["Blue", "#2563eb"],
    ["Violet", "#7c3aed"],
  ];
  const cx = 240;
  const cy = 140;
  let out = "";
  segs.forEach(([name, colour], i) => {
    const a0 = i * 60 - 30;
    const a1 = a0 + 60;
    const [x0, y0] = pt(cx, cy, 100, a0);
    const [x1, y1] = pt(cx, cy, 100, a1);
    const on = highlight.includes(name!);
    out += `<path d="M ${cx} ${cy} L ${x0} ${y0} A 100 100 0 0 1 ${x1} ${y1} Z" fill="${colour}" opacity="${highlight.length && !on ? 0.3 : 1}" stroke="#ffffff" stroke-width="3"/>`;
    const [lx, ly] = pt(cx, cy, 124, i * 60);
    out += `<text x="${lx}" y="${ly + 5}" text-anchor="middle" font-family="${FONT}" font-size="13" font-weight="${on ? "bold" : "normal"}" fill="${INK}">${name}</text>`;
  });
  return frame(out, caption);
}

/** A small family tree: rows of labelled boxes joined to the row above. */
export function familyTreeSvg(rows: string[][], caption: string, mark?: string) {
  let out = "";
  const pos: Record<string, [number, number]> = {};
  rows.forEach((row, r) => {
    row.forEach((name, i) => {
      const x = 240 + (i - (row.length - 1) / 2) * 150;
      const y = 60 + r * 80;
      pos[`${r}:${i}`] = [x, y];
      const on = name === mark;
      out += `<rect x="${x - 55}" y="${y - 20}" width="110" height="40" rx="8" fill="${on ? "#fde68a" : "#eff6ff"}" stroke="${INK}" stroke-width="2"/>
<text x="${x}" y="${y + 6}" text-anchor="middle" font-family="${FONT}" font-size="15" fill="${INK}">${esc(name)}</text>`;
      if (r > 0) {
        const [px, py] = pos[`${r - 1}:0`]!;
        out += `<line x1="${px}" y1="${py + 20}" x2="${x}" y2="${y - 20}" stroke="${MUTED}" stroke-width="2"/>`;
      }
    });
  });
  return frame(out, caption);
}

/** Two rectangles comparing aspect ratios. */
export function aspectSvg(caption: string) {
  return frame(
    `<rect x="60" y="80" width="192" height="108" fill="#dbeafe" stroke="${INK}" stroke-width="2"/>
<text x="156" y="140" text-anchor="middle" font-family="${FONT}" font-size="18" font-weight="bold" fill="${ACCENT}">16 : 9</text>
<rect x="300" y="80" width="128" height="96" fill="#f1f5f9" stroke="${INK}" stroke-width="2"/>
<text x="364" y="134" text-anchor="middle" font-family="${FONT}" font-size="18" fill="${MUTED}">4 : 3</text>`,
    caption,
  );
}

/** A pencil-style practice sketch of a bus terminus seen from above (varies with `seed`). */
export function terminusSketchSvg(seed: number, refined = false): string {
  const rnd = (n: number) => {
    const x = Math.sin(seed * 9301 + n * 49297) * 233280;
    return x - Math.floor(x);
  };
  const pencil = refined ? "#334155" : "#64748b";
  const vpX = 200 + rnd(1) * 80;
  const vpY = 80 + rnd(2) * 30;
  let lines = "";
  // Platform edges and roof lines towards the vanishing point.
  for (const [x, y] of [
    [0, 300],
    [480, 300],
    [0, 220],
    [480, 230],
    [60, 0],
    [430, 0],
  ] as const) {
    lines += `<line x1="${x}" y1="${y}" x2="${vpX}" y2="${vpY}" stroke="${pencil}" stroke-width="${refined ? 1.6 : 1}" stroke-dasharray="${refined ? "" : "6 3"}"/>`;
  }
  // A bus pulling in.
  const bx = 250 + rnd(3) * 60;
  lines += `<path d="M ${bx} 170 L ${bx + 130} 200 L ${bx + 130} 260 L ${bx} 240 Z" fill="none" stroke="${pencil}" stroke-width="2"/>`;
  lines += `<line x1="${bx + 20}" y1="185" x2="${bx + 110}" y2="205" stroke="${pencil}" stroke-width="1"/>`;
  // People waiting at three depths.
  for (let i = 0; i < (refined ? 7 : 4); i++) {
    const depth = 0.4 + rnd(10 + i) * 0.6;
    const px = 40 + rnd(20 + i) * 190;
    const py = 150 + depth * 120;
    const h = 22 + depth * 34;
    lines += `<circle cx="${px}" cy="${py - h}" r="${h * 0.12}" fill="none" stroke="${pencil}" stroke-width="1.4"/>`;
    lines += `<line x1="${px}" y1="${py - h * 0.88}" x2="${px}" y2="${py - h * 0.4}" stroke="${pencil}" stroke-width="1.4"/>`;
    lines += `<line x1="${px}" y1="${py - h * 0.4}" x2="${px - h * 0.15}" y2="${py}" stroke="${pencil}" stroke-width="1.4"/>`;
    lines += `<line x1="${px}" y1="${py - h * 0.4}" x2="${px + h * 0.15}" y2="${py}" stroke="${pencil}" stroke-width="1.4"/>`;
    if (refined) {
      lines += `<ellipse cx="${px + 4}" cy="${py + 2}" rx="${h * 0.25}" ry="${h * 0.05}" fill="#cbd5e1"/>`;
    }
  }
  // A sign board.
  lines += `<rect x="${60 + rnd(4) * 40}" y="40" width="110" height="28" fill="none" stroke="${pencil}" stroke-width="1.5"/>`;
  lines += `<text x="${72 + rnd(4) * 40}" y="59" font-family="${FONT}" font-size="13" fill="${pencil}">BAY ${1 + Math.floor(rnd(5) * 9)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300" viewBox="0 0 480 300">
<rect width="480" height="300" fill="#fbfaf7"/>
${lines}
</svg>`;
}
