/**
 * Practice library sample data (student module): every Practice tab filled
 * with tests, and every question carrying an explanation, some with a figure,
 * step-by-step images, a video and reference links.
 *
 * All questions are original and the papers are "practice papers in the
 * pattern of" a given exam/year, not official papers. Diagrams are generated
 * in code (seed-diagrams.ts). The video is a placeholder: the Blender
 * Foundation's open film "Big Buck Bunny" (CC BY 3.0), to be replaced with
 * real solution videos from the admin question editor.
 */
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Prisma, PrismaClient } from "../generated/client/index.js";
import * as D from "./seed-diagrams.js";
import { deterministicUuid } from "./seed-id.js";

const sid = (label: string) => deterministicUuid("examora-student-module-seed", label);
const sampleQ = (quiz: string, i: number) => sid(`question:${quiz}/${i}`);
const bankQ = (key: string) => sid(`lib-question:${key}`);
const NID_COURSE = sid("course:nid-ug-uceed");
const subjectId = (s: string) => sid(`subject:${s}`);
const topicId = (s: string, t: string) => sid(`topic:${s}/${t}`);

/** Placeholder solution video (open film, CC BY 3.0): replace from the admin editor. */
const PLACEHOLDER_VIDEO = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";
const wiki = (label: string, page: string) => ({
  label,
  url: `https://en.wikipedia.org/wiki/${page}`,
});

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

async function upload(key: string, body: Buffer, contentType: string): Promise<boolean> {
  const client = new S3Client({
    endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
    region: process.env.S3_REGION ?? "us-east-1",
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET ?? "examora-uploads",
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
      { abortSignal: controller.signal },
    );
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
    client.destroy();
  }
}

/** name → [svg, alt text] */
const DIAGRAMS: Record<string, () => [string, string]> = {
  "clock-300": () => [
    D.clockSvg(3, 0, "Minute hand on 12, hour hand on 3: a quarter turn = 90°", "Step 2"),
    "Clock at 3:00",
  ],
  "clock-300-a": () => [
    D.workingSvg(
      "Step 1",
      ["Full turn = 360°", "12 hour marks", "360° ÷ 12 = 30° per hour mark"],
      "Each hour mark is 30° apart",
    ),
    "Each hour mark is 30 degrees",
  ],
  "clock-300-b": () => [
    D.workingSvg("Step 3", ["Hands are 3 hour marks apart", "3 × 30° = 90°"], "Answer: 90°"),
    "Three marks times thirty degrees is ninety",
  ],
  "clock-630": () => [
    D.clockSvg(6, 30, "6 hours × 5 minutes gained = 30 minutes ahead → 6:30", undefined, false),
    "Clock showing 6:30",
  ],
  "clock-420-a": () => [
    D.workingSvg(
      "Step 1: minute hand",
      ["Minute hand moves 6° per minute", "20 minutes × 6° = 120°"],
      "Minute hand at 120° from 12",
    ),
    "Minute hand at 120 degrees",
  ],
  "clock-420-b": () => [
    D.workingSvg(
      "Step 2: hour hand",
      ["Hour hand moves 30° per hour + 0.5° per minute", "4 × 30° + 20 × 0.5° = 130°"],
      "Hour hand at 130° from 12",
    ),
    "Hour hand at 130 degrees",
  ],
  "clock-420-c": () => [
    D.clockSvg(4, 20, "Difference: 130° − 120° = 10°", "Step 3"),
    "Clock at 4:20 with a 10 degree angle",
  ],
  "fold-1": () => [D.paperFoldSvg(1, "Fold the square in half along the dashed line"), "Fold"],
  "fold-2": () => [D.paperFoldSvg(2, "One punch goes through both layers"), "Punch"],
  "fold-3": () => [
    D.paperFoldSvg(3, "Unfold: the hole is mirrored across the fold → 2 holes"),
    "Unfold",
  ],
  walk: () => [D.walkSvg("√(4² + 3²) = √25 = 5 km"), "Walk 4 km north then 3 km east"],
  "rect-diag": () => [D.diagonalSvg("d² = 12² + 5² = 169, so d = 13 cm"), "Rectangle diagonal"],
  "circle-7": () => [D.circleSvg("Diameter 14 cm, so radius r = 7 cm", "r = 7 cm"), "Circle"],
  "circle-area": () => [
    D.workingSvg(
      "Area = πr²",
      ["π = 22/7, r = 7", "22/7 × 7 × 7", "= 22 × 7 = 154 cm²"],
      "Area of the circle",
    ),
    "Area working",
  ],
  "cube-corners": () => [D.cubeSvg("8 corner cubes: 3 painted faces each", "corners"), "Corners"],
  "cube-edges": () => [
    D.cubeSvg("1 middle cube on each of 12 edges: 2 painted faces → 12", "edges"),
    "Edges",
  ],
  "cube-centres": () => [
    D.cubeSvg("6 face-centre cubes: 1 painted face; the 1 inner cube has none", "centres"),
    "Centres",
  ],
  "persp-1": () => [
    D.perspectiveSvg(1, "One-point: depth lines meet at a single vanishing point"),
    "One-point perspective",
  ],
  "persp-2": () => [
    D.perspectiveSvg(2, "Two-point: verticals stay vertical; other edges meet at VP1 or VP2"),
    "Two-point perspective",
  ],
  "wheel-warm": () => [
    D.colourWheelSvg("Warm colours: red, orange and yellow", ["Red", "Orange", "Yellow"]),
    "Warm colours on the wheel",
  ],
  "wheel-comp": () => [
    D.colourWheelSvg("Complementary pairs sit opposite each other", ["Blue", "Orange"]),
    "Complementary colours",
  ],
  "wheel-secondary": () => [
    D.colourWheelSvg("Secondary colours mix two primaries", ["Orange", "Green", "Violet"]),
    "Secondary colours",
  ],
  "tree-uncle": () => [
    D.familyTreeSvg(
      [["B (mother)", "A (brother)"], ["C"]],
      "A is the brother of C's mother",
      "A (brother)",
    ),
    "Family tree",
  ],
  "tree-father": () => [
    D.familyTreeSvg([["P", "Q (wife)"], ["R (son)"]], "P is Q's husband, so P is R's father", "P"),
    "Family tree",
  ],
  aspect: () => [D.aspectSvg("HD video is 16:9; older TVs were 4:3"), "Aspect ratios"],
  "wave-working": () => [
    D.workingSvg(
      "v = f × λ",
      [
        "Speed of sound in air is fixed (≈ 343 m/s)",
        "If λ doubles, f must halve",
        "Longer λ ⇒ lower f",
      ],
      "Frequency and wavelength are inversely related",
    ),
    "Wave equation",
  ],
  "riya-1": () => [
    D.workingSvg(
      "Step 1",
      ['"The only daughter of my mother"', "= Riya herself"],
      "Decode the phrase",
    ),
    "Step 1",
  ],
  "riya-2": () => [
    D.workingSvg("Step 2", ["His mother = Riya", "So the man is Riya's son"], "Answer: son"),
    "Step 2",
  ],
  "chess-1": () => [
    D.workingSvg(
      "Count squares of each size",
      ["1×1: 64    2×2: 49    3×3: 36    4×4: 25", "5×5: 16    6×6: 9    7×7: 4    8×8: 1"],
      "An 8×8 board has (9 − k)² squares of size k",
    ),
    "Squares by size",
  ],
  "chess-2": () => [
    D.workingSvg("Add them up", ["64 + 49 + 36 + 25 + 16 + 9 + 4 + 1", "= 204"], "Answer: 204"),
    "Total",
  ],
  "queue-1": () => [
    D.workingSvg(
      "Step 1",
      ["Esha is first, Dev is last", "1 Esha  2 ?  3 ?  4 ?  5 Dev"],
      "Fix the ends",
    ),
    "Step 1",
  ],
  "queue-2": () => [
    D.workingSvg(
      "Step 2",
      ["Chirag ahead of Asha, Asha ahead of Ben", "1 Esha  2 Chirag  3 Asha  4 Ben  5 Dev"],
      "Fourth in line: Ben",
    ),
    "Step 2",
  ],
  "series-letters": () => [
    D.workingSvg(
      "Gaps grow by one",
      ["A(1) C(3) F(6) J(10) O(15)", "+2  +3  +4  +5  +6", "15 + 6 = 21 → U"],
      "Answer: U",
    ),
    "Letter series",
  ],
  "series-n2": () => [
    D.workingSvg(
      "Pattern: n × (n + 1)",
      ["1×2, 2×3, 3×4, 4×5, 5×6", "next: 6 × 7 = 42"],
      "Answer: 42",
    ),
    "Number series",
  ],
};

for (let i = 1; i <= 6; i++) {
  DIAGRAMS[`peer-sketch-${i}`] = () => [D.terminusSketchSvg(i), `Classmate sketch ${i}`];
  DIAGRAMS[`peer-sketch-${i}-rev`] = () => [
    D.terminusSketchSvg(i, true),
    `Classmate sketch ${i}, revised`,
  ];
}

class Media {
  private cache = new Map<string, string | null>();
  constructor(
    private readonly prisma: PrismaClient,
    private readonly adminId: string,
  ) {}

  /** "media:<id>" for a diagram (uploaded once), "rot:<name>" for a rotation figure, else null. */
  async ref(name: string): Promise<string | null> {
    if (this.cache.has(name)) return this.cache.get(name)!;
    let ref: string | null = null;
    if (name.startsWith("rot:")) {
      const id = sid(`media:rotation/${name.slice(4)}`);
      const asset = await this.prisma.cmsAsset.findUnique({ where: { id }, select: { id: true } });
      ref = asset ? `media:${asset.id}` : null;
    } else {
      const make = DIAGRAMS[name];
      if (!make) throw new Error(`Unknown diagram ${name}`);
      const id = sid(`media:lib/${name}`);
      const existing = await this.prisma.cmsAsset.findUnique({
        where: { id },
        select: { id: true },
      });
      if (existing) ref = `media:${id}`;
      else {
        const [svg, alt] = make();
        const body = Buffer.from(svg, "utf8");
        const key = `study-media/sample/explain-${name}.svg`;
        if (await upload(key, body, "image/svg+xml")) {
          await this.prisma.cmsAsset.create({
            data: {
              id,
              storageKey: key,
              fileName: `explain-${name}.svg`,
              mimeType: "image/svg+xml",
              sizeBytes: body.length,
              altText: alt,
              uploadedById: this.adminId,
              scanStatus: "CLEAN",
            },
          });
          ref = `media:${id}`;
        }
      }
    }
    this.cache.set(name, ref);
    return ref;
  }
}

// ---------------------------------------------------------------------------
// Explanations
// ---------------------------------------------------------------------------

interface Explain {
  text: string;
  image?: string;
  steps?: [diagram: string, caption: string][];
  video?: boolean;
  links?: { label: string; url: string }[];
}

async function explanationData(media: Media, e: Explain) {
  const steps: { imageUrl: string; caption: string }[] = [];
  for (const [name, caption] of e.steps ?? []) {
    const ref = await media.ref(name);
    if (ref) steps.push({ imageUrl: ref, caption });
  }
  return {
    explanation: e.text,
    explanationImageUrl: e.image ? await media.ref(e.image) : null,
    explanationVideoUrl: e.video ? PLACEHOLDER_VIDEO : null,
    explanationSteps: steps as unknown as Prisma.InputJsonValue,
    resources: (e.links ?? []) as unknown as Prisma.InputJsonValue,
  };
}

/** Explanations for the earlier sample questions that had none, keyed by question text. */
const BACKFILL: Record<string, Explain> = {
  "As the wavelength of a sound wave increases, its frequency…": {
    text: "Speed = frequency × wavelength. The speed of sound in air is fixed, so a **longer wavelength means a lower frequency**: the two are inversely proportional.",
    image: "wave-working",
    links: [wiki("Wavelength", "Wavelength"), wiki("Frequency", "Frequency")],
  },
  "What is the SI unit of frequency?": {
    text: "Frequency is measured in **hertz (Hz)**: one hertz is one cycle per second. Ohm is resistance, decibel is sound level and watt is power.",
    links: [wiki("Hertz", "Hertz")],
  },
  "Sound pressure level is usually measured in…": {
    text: "Sound level uses the **decibel (dB)**, a logarithmic scale: +10 dB is ten times the sound intensity.",
    video: true,
    links: [wiki("Decibel", "Decibel")],
  },
  'In "1080p", the number 1080 refers to…': {
    text: "**1080 is the number of horizontal lines (vertical resolution)**; the *p* means progressive scan. Full HD is 1920 × 1080 pixels.",
    links: [wiki("1080p", "1080p")],
  },
  "Frame rate is measured in…": {
    text: "Frame rate counts images shown per second: **frames per second (fps)**. Cinema is usually 24 fps, video often 25, 30 or 60.",
    links: [wiki("Frame rate", "Frame_rate")],
  },
  "Which of these audio formats is lossless?": {
    text: "**FLAC** (Free Lossless Audio Codec) keeps every bit of the original. MP3, AAC and Ogg Vorbis throw away detail to save space (lossy).",
    links: [wiki("FLAC", "FLAC")],
  },
  "What is the aspect ratio of standard HD video?": {
    text: "HD video is **16:9** (width : height). 4:3 was standard-definition TV; 21:9 is ultra-wide cinema.",
    image: "aspect",
    links: [wiki("16:9 aspect ratio", "16:9_aspect_ratio")],
  },
  "Which microphone pattern picks up sound mainly from the front?": {
    text: "A **cardioid** (heart-shaped) pattern picks up mostly from the front and rejects sound from behind. Omnidirectional picks up all round; figure-8 picks up front and back.",
    links: [wiki("Microphone polar patterns", "Microphone#Polar_patterns")],
  },
  "In digital audio, bit depth determines…": {
    text: "Bit depth is how many bits record each sample, so it sets the **precision and dynamic range** (about 6 dB per bit: 16-bit ≈ 96 dB).",
    links: [wiki("Audio bit depth", "Audio_bit_depth")],
  },
  'The word "codec" is short for…': {
    text: "**Coder–decoder** (or compressor–decompressor): software or hardware that encodes media for storage and decodes it for playback.",
    links: [wiki("Codec", "Codec")],
  },
  "A is B's brother and B is C's mother. How is A related to C?": {
    text: "B is C's mother, and A is B's brother. A mother's brother is a **(maternal) uncle**.",
    image: "tree-uncle",
  },
  'Pointing to a man, Riya says, "His mother is the only daughter of my mother." How is the man related to Riya?':
    {
      text: "\"The only daughter of my mother\" is Riya herself. So the man's mother is Riya, and he is Riya's **son**.",
      steps: [
        ["riya-1", "Decode the phrase: the only daughter of Riya's mother is Riya"],
        ["riya-2", "His mother is Riya, so he is her son"],
      ],
    },
  "X is the father of Y, and Y is the sister of Z. How is X related to Z?": {
    text: "Y and Z are siblings, so they share parents. X, Y's father, is also Z's **father**, whether Z is a boy or a girl.",
  },
  "P is the husband of Q, and R is the son of Q. How is P related to R?": {
    text: "R is Q's son and P is Q's husband, so P is R's **father**.",
    image: "tree-father",
  },
  "Isometric drawings use angles of…": {
    text: "In isometric drawing the two horizontal axes are drawn at **30°** to the horizontal, and the third axis is vertical, so all three are 120° apart.",
    links: [wiki("Isometric projection", "Isometric_projection")],
  },
  "Which colour model is used for screens?": {
    text: "Screens emit light, so they mix **red, green and blue (RGB)** additively. CMYK is for printing with inks.",
    links: [wiki("RGB colour model", "RGB_color_model")],
  },
  "A typeface without small strokes at the ends of letters is called…": {
    text: "Those small strokes are serifs; a typeface without them is **sans-serif** (sans = without), e.g. Helvetica.",
    links: [wiki("Sans-serif", "Sans-serif")],
  },
  "The golden ratio is approximately…": {
    text: "The golden ratio φ = (1 + √5) / 2 ≈ **1.618**. 1.414 is √2, 2.718 is e and 3.142 is π.",
    links: [wiki("Golden ratio", "Golden_ratio")],
  },
  "Which of these is a warm colour?": {
    text: "Reds, **oranges** and yellows are warm colours; blues, teals and violets are cool.",
    image: "wheel-warm",
    links: [wiki("Colour wheel", "Color_wheel")],
  },
  "A drawing showing an object from directly above is a…": {
    text: "A view from directly above is a **plan**. An elevation is a side view; a section is a cut through the object.",
    links: [wiki("Orthographic projection", "Multiview_orthographic_projection")],
  },
  "Which art movement is known for dream-like imagery?": {
    text: "**Surrealism** (Dalí, Magritte) explored dreams and the unconscious. Cubism broke objects into planes; Minimalism stripped forms back.",
    video: true,
    links: [wiki("Surrealism", "Surrealism")],
  },
  "In photography, a smaller f-number means a…": {
    text: "The f-number is focal length ÷ aperture diameter, so a **smaller f-number (e.g. f/1.8) means a wider aperture**: more light and a shallower depth of field.",
    links: [wiki("F-number", "F-number")],
  },
  "Kalamkari is a traditional craft of…": {
    text: 'Kalamkari ("pen-work") is **hand-painted or block-printed cotton textile**, from Andhra Pradesh and Telangana.',
    links: [wiki("Kalamkari", "Kalamkari")],
  },
  "Complementary colours sit…": {
    text: "Complementary colours sit **opposite each other** on the colour wheel (blue–orange, red–green), giving the strongest contrast.",
    image: "wheel-comp",
    links: [wiki("Complementary colours", "Complementary_colors")],
  },
  "Which unit measures screen resolution density?": {
    text: "**PPI (pixels per inch)** measures how densely pixels are packed. Lux and lumen measure light; hertz measures frequency.",
    links: [wiki("Pixel density", "Pixel_density")],
  },
  "A perspective drawing with two vanishing points is…": {
    text: "With two vanishing points on the horizon it is **two-point perspective**: verticals stay vertical, and the other edges run to one point or the other.",
    image: "persp-2",
    links: [wiki("Perspective (graphical)", "Perspective_(graphical)")],
  },
  "Which material is a thermoplastic?": {
    text: "**Polypropylene** softens when heated and can be remoulded, so it is a thermoplastic. Oak, granite and clay are not plastics.",
    links: [wiki("Polypropylene", "Polypropylene")],
  },
  "Which of these is a primary colour in light?": {
    text: "The additive (light) primaries are red, **green** and blue. Yellow, magenta and cyan are the primaries for ink.",
    links: [wiki("Additive colour", "Additive_color")],
  },
  "Bauhaus was a school of…": {
    text: "The **Bauhaus** (Germany, 1919–1933) was a school of design, architecture and applied arts that joined craft with industry.",
    video: true,
    links: [wiki("Bauhaus", "Bauhaus")],
  },
  "Esha is first, Dev is last, Asha is ahead of Ben but behind Chirag. Who is fourth?": {
    text: "Fix the ends first, then place the others in order: Esha, Chirag, Asha, **Ben**, Dev.",
    steps: [
      ["queue-1", "Fix the people whose places are given"],
      ["queue-2", "Chirag → Asha → Ben fill the middle in order"],
    ],
  },
  "What is the angle between the hands of a clock at 3:00?": {
    text: "Each hour mark is 30° apart. At 3:00 the hands are three marks apart: 3 × 30° = **90°**.",
    steps: [
      ["clock-300-a", "A full turn is 360°, so each hour mark is 30°"],
      ["clock-300", "At 3:00 the hands point at 12 and 3"],
      ["clock-300-b", "Three marks apart: 3 × 30° = 90°"],
    ],
    video: true,
    links: [wiki("Clock angle problem", "Clock_angle_problem")],
  },
  "A shop opens on alternate days starting Monday. Which day is it closed?": {
    text: "Open Monday, Wednesday, Friday, Sunday; closed Tuesday, Thursday and **Saturday**. Saturday is the only closed day in the options.",
  },
  "Find the missing number: 3, 9, 27, ?, 243": {
    text: "Each term is 3 times the one before: 27 × 3 = **81**, and 81 × 3 = 243 checks out.",
  },
  "How many squares are on a standard chessboard (all sizes)?": {
    text: "Count every size: 1² + 2² + … + 8² = **204**.",
    steps: [
      ["chess-1", "An 8×8 board has (9 − k)² squares of size k × k"],
      ["chess-2", "Add the counts: 204"],
    ],
  },
  "A clock gains 5 minutes every hour. It is set right at noon. What does it show at 6 pm?": {
    text: "From noon to 6 pm is 6 hours, so it gains 6 × 5 = 30 minutes and shows **6:30**.",
    image: "clock-630",
  },
  "What is the sum of the first 10 odd numbers?": {
    text: "The sum of the first n odd numbers is n². For n = 10: **100** (1 + 3 + 5 + … + 19).",
  },
};

// ---------------------------------------------------------------------------
// Question bank (original questions)
// ---------------------------------------------------------------------------

type QType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "NUMERIC" | "UPLOAD";

interface BankQuestion {
  key: string;
  subject: string;
  topic?: string;
  type: QType;
  text: string;
  /** [text, correct, optional figure ("rot:<name>")] */
  options?: [string, boolean, string?][];
  numeric?: [number, number];
  partial?: boolean;
  criteria?: string[];
  image?: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD";
  daily?: boolean;
  explain: Explain;
}

const TF = (correct: boolean): [string, boolean][] => [
  ["True", correct],
  ["False", !correct],
];

const BANK: BankQuestion[] = [
  // Mental ability
  {
    key: "puz-widgets",
    subject: "mental-ability",
    topic: "puzzles",
    type: "NUMERIC",
    text: "5 machines make 5 widgets in 5 minutes. How many minutes do 100 machines take to make 100 widgets?",
    numeric: [5, 5],
    explain: {
      text: "Each machine makes **1 widget in 5 minutes**. 100 machines working together make 100 widgets in the same **5 minutes**.",
    },
  },
  {
    key: "clock-420",
    subject: "mental-ability",
    topic: "puzzles",
    type: "SINGLE_CHOICE",
    text: "What is the smaller angle between the hands of a clock at 4:20?",
    options: [
      ["10°", true],
      ["20°", false],
      ["0°", false],
      ["30°", false],
    ],
    explain: {
      text: "Minute hand: 20 × 6° = 120°. Hour hand: 4 × 30° + 20 × 0.5° = 130°. Angle = 130° − 120° = **10°**. (The hour hand keeps moving 0.5° every minute.)",
      steps: [
        ["clock-420-a", "Where the minute hand is"],
        ["clock-420-b", "Where the hour hand is (it moves too)"],
        ["clock-420-c", "Subtract: 10°"],
      ],
      video: true,
      links: [wiki("Clock angle problem", "Clock_angle_problem")],
    },
  },
  {
    key: "series-n2",
    subject: "mental-ability",
    topic: "sequences",
    type: "SINGLE_CHOICE",
    text: "Which number comes next: 2, 6, 12, 20, 30, ?",
    options: [
      ["40", false],
      ["42", true],
      ["44", false],
      ["36", false],
    ],
    explain: {
      text: "The terms are 1×2, 2×3, 3×4, 4×5, 5×6, so next is 6 × 7 = **42**. (Differences 4, 6, 8, 10, 12 confirm it.)",
      image: "series-n2",
    },
  },
  {
    key: "code-cat",
    subject: "mental-ability",
    topic: "coding-decoding",
    type: "SINGLE_CHOICE",
    text: "If CAT is written as DBU, how is DOG written in the same code?",
    options: [
      ["EPH", true],
      ["EOH", false],
      ["FPH", false],
      ["DPG", false],
    ],
    explain: {
      text: "Each letter moves one place forward: C→D, A→B, T→U. So D→E, O→P, G→H: **EPH**.",
    },
  },
  {
    key: "walk-5",
    subject: "mental-ability",
    topic: "direction-sense",
    type: "NUMERIC",
    text: "Ravi walks 4 km north, turns right and walks 3 km. How far is he from where he started, in km?",
    numeric: [5, 5],
    explain: {
      text: "Turning right from north means walking east. The two legs make a right angle, so the distance is √(4² + 3²) = **5 km**.",
      image: "walk",
      links: [wiki("Pythagorean theorem", "Pythagorean_theorem")],
    },
  },
  {
    key: "seating",
    subject: "mental-ability",
    topic: "seating",
    type: "SINGLE_CHOICE",
    text: "Five friends sit in a row facing you. Chirag is at the left end, Dev is in the middle, Esha sits next to Chirag, and Asha sits immediately to the right of Ben. Who is at the right end?",
    options: [
      ["Asha", true],
      ["Ben", false],
      ["Dev", false],
      ["Esha", false],
    ],
    explain: {
      text: "Seats 1–5 from the left: Chirag 1, Esha 2, Dev 3. Ben and Asha must be side by side with Asha on the right, so Ben 4 and **Asha 5**.",
    },
  },
  {
    key: "analogy-knife",
    subject: "mental-ability",
    topic: "analogies",
    type: "SINGLE_CHOICE",
    text: "Pen : Write :: Knife : ?",
    options: [
      ["Cut", true],
      ["Kitchen", false],
      ["Sharp", false],
      ["Steel", false],
    ],
    explain: { text: "A pen is a tool used **to write**; a knife is a tool used **to cut**." },
  },
  {
    key: "odd-cube",
    subject: "mental-ability",
    topic: "odd-one-out",
    type: "SINGLE_CHOICE",
    text: "Which is the odd one out?",
    options: [
      ["Circle", false],
      ["Square", false],
      ["Triangle", false],
      ["Cube", true],
    ],
    explain: {
      text: "Circle, square and triangle are flat (2D) shapes; a **cube** is a solid (3D).",
    },
  },
  {
    key: "fold-holes",
    subject: "mental-ability",
    topic: "paper-folding",
    type: "NUMERIC",
    text: "A square sheet is folded in half once and one hole is punched through both layers. How many holes are there when it is unfolded?",
    numeric: [2, 2],
    explain: {
      text: "The punch goes through two layers, so unfolding shows the hole and its mirror image across the fold: **2 holes**.",
      steps: [
        ["fold-1", "Fold the sheet in half"],
        ["fold-2", "Punch once through both layers"],
        ["fold-3", "Unfold: two holes, mirrored across the fold"],
      ],
    },
  },
  {
    key: "series-letters",
    subject: "mental-ability",
    topic: "series-completion",
    type: "SINGLE_CHOICE",
    text: "Which letter comes next: A, C, F, J, O, ?",
    options: [
      ["T", false],
      ["U", true],
      ["V", false],
      ["W", false],
    ],
    explain: {
      text: "Positions 1, 3, 6, 10, 15: the gap grows by one each time (+2, +3, +4, +5). Next is 15 + 6 = 21 = **U**.",
      image: "series-letters",
    },
  },
  // Analytical reasoning
  {
    key: "syllogism",
    subject: "analytical-reasoning",
    topic: "syllogisms",
    type: "SINGLE_CHOICE",
    text: "All chairs are furniture. Some furniture is wooden. Which conclusion definitely follows?",
    options: [
      ["All chairs are wooden", false],
      ["Some chairs are wooden", false],
      ["Neither of these follows for certain", true],
      ["All wooden things are chairs", false],
    ],
    explain: {
      text: "The wooden furniture might all be tables. Nothing forces any chair to be wooden, so **neither conclusion follows for certain**.",
      links: [wiki("Syllogism", "Syllogism")],
    },
  },
  {
    key: "tf-tablet",
    subject: "analytical-reasoning",
    topic: "statements",
    type: "TRUE_FALSE",
    text: "True or false: Every designer in a studio uses a tablet. Meera is a designer in that studio. So Meera uses a tablet.",
    options: TF(true),
    explain: {
      text: "**True.** The rule covers every designer in the studio, and Meera is one of them.",
    },
  },
  {
    key: "ds-x",
    subject: "analytical-reasoning",
    topic: "data-sufficiency",
    type: "SINGLE_CHOICE",
    text: "Is x greater than 10? Statement (1): x > 12. Statement (2): x < 15.",
    options: [
      ["(1) alone is enough", true],
      ["(2) alone is enough", false],
      ["Both together are needed", false],
      ["Neither is enough", false],
    ],
    explain: {
      text: "(1) x > 12 already means x > 10: **sufficient alone**. (2) x < 15 allows both 5 and 14, so it is not enough on its own.",
    },
  },
  // Visual & spatial
  {
    key: "rot-180",
    subject: "visual-spatial",
    topic: "rotation",
    type: "SINGLE_CHOICE",
    text: "Figure P (shown) is rotated 180°. Which option shows the result?",
    image: "rot:p",
    options: [
      ["A", false, "rot:rot90"],
      ["B", true, "rot:rot180"],
      ["C", false, "rot:mirror"],
      ["D", false, "rot:mirrorRot"],
    ],
    explain: {
      text: "A 180° turn is two quarter turns. Turn P 90° clockwise, then 90° again: that is **option B**. Mirror images (C, D) can never be made by rotating.",
      steps: [
        ["rot:p", "Start with figure P"],
        ["rot:rot90", "Turn 90° clockwise"],
        ["rot:rot180", "Turn another 90°: 180° in total"],
      ],
    },
  },
  {
    key: "mirror-p",
    subject: "visual-spatial",
    topic: "mirror-images",
    type: "SINGLE_CHOICE",
    text: "A mirror stands to the right of figure P (shown). Which option shows its reflection?",
    image: "rot:p",
    options: [
      ["A", true, "rot:mirror"],
      ["B", false, "rot:rot90"],
      ["C", false, "rot:rot180"],
      ["D", false, "rot:mirrorRot"],
    ],
    explain: {
      text: "A mirror on the right flips the figure left-to-right but keeps top and bottom: **option A**.",
    },
  },
  {
    key: "cube-adjacent",
    subject: "visual-spatial",
    topic: "cubes-dice",
    type: "NUMERIC",
    text: "How many faces of a cube share an edge with any one chosen face?",
    numeric: [4, 4],
    explain: {
      text: "A cube has 6 faces. One is the chosen face and one is opposite it; the other **4** each share an edge with it.",
    },
  },
  {
    key: "cube-27",
    subject: "visual-spatial",
    topic: "cubes-dice",
    type: "NUMERIC",
    text: "A cube painted on all faces is cut into 27 equal small cubes. How many small cubes have exactly two painted faces?",
    numeric: [12, 12],
    difficulty: "HARD",
    explain: {
      text: "Two painted faces = the middle cube on each edge. A cube has 12 edges, so **12**. (8 corners have three, 6 face centres have one, 1 inner cube has none: 8 + 12 + 6 + 1 = 27.)",
      steps: [
        ["cube-corners", "Corners: 3 painted faces"],
        ["cube-edges", "Edge middles: 2 painted faces, one per edge → 12"],
        ["cube-centres", "Face centres: 1 painted face"],
      ],
      video: true,
    },
  },
  {
    key: "triangles",
    subject: "visual-spatial",
    topic: "hidden-figures",
    type: "NUMERIC",
    text: "A triangle is split by one straight line from a corner to the opposite side. How many triangles are in the figure altogether?",
    numeric: [3, 3],
    explain: {
      text: "The line makes **2 small triangles**, and the original big triangle still counts: **3** in total.",
    },
  },
  // General knowledge
  {
    key: "eames",
    subject: "general-knowledge",
    topic: "famous-designers",
    type: "SINGLE_CHOICE",
    text: "Who designed the Eames Lounge Chair (1956)?",
    daily: true,
    options: [
      ["Charles and Ray Eames", true],
      ["Le Corbusier", false],
      ["Dieter Rams", false],
      ["Philippe Starck", false],
    ],
    explain: {
      text: "The lounge chair and ottoman were designed by **Charles and Ray Eames** for Herman Miller in 1956, using moulded plywood and leather.",
      links: [wiki("Eames Lounge Chair", "Eames_Lounge_Chair")],
    },
  },
  {
    key: "lotus",
    subject: "general-knowledge",
    topic: "famous-designers",
    type: "SINGLE_CHOICE",
    text: "The Lotus Temple in New Delhi was designed by…",
    daily: true,
    options: [
      ["Fariborz Sahba", true],
      ["Charles Correa", false],
      ["B. V. Doshi", false],
      ["Laurie Baker", false],
    ],
    explain: {
      text: 'The Lotus Temple (1986) was designed by the Iranian-Canadian architect **Fariborz Sahba**: 27 marble-clad "petals" in clusters of three.',
      links: [wiki("Lotus Temple", "Lotus_Temple")],
    },
  },
  {
    key: "mondrian",
    subject: "general-knowledge",
    topic: "art-movements",
    type: "SINGLE_CHOICE",
    text: "Piet Mondrian is most associated with which art movement?",
    daily: true,
    options: [
      ["De Stijl", true],
      ["Cubism", false],
      ["Impressionism", false],
      ["Surrealism", false],
    ],
    explain: {
      text: "Mondrian co-founded **De Stijl** (Netherlands, 1917): straight black lines, primary colours and white.",
      links: [wiki("De Stijl", "De_Stijl")],
    },
  },
  {
    key: "starry",
    subject: "general-knowledge",
    topic: "art-movements",
    type: "SINGLE_CHOICE",
    text: 'Who painted "The Starry Night" (1889)?',
    daily: true,
    options: [
      ["Vincent van Gogh", true],
      ["Claude Monet", false],
      ["Pablo Picasso", false],
      ["Salvador Dalí", false],
    ],
    explain: {
      text: "**Vincent van Gogh** painted it from his room at the asylum in Saint-Rémy-de-Provence.",
      links: [wiki("The Starry Night", "The_Starry_Night")],
    },
  },
  {
    key: "crafts-msq",
    subject: "general-knowledge",
    topic: "indian-crafts",
    type: "MULTIPLE_CHOICE",
    text: "Which of these are traditional Indian textile crafts? Select all that apply.",
    partial: true,
    options: [
      ["Bandhani", true],
      ["Ikat", true],
      ["Chikankari", true],
      ["Origami", false],
    ],
    explain: {
      text: "**Bandhani** (tie-dye, Gujarat/Rajasthan), **Ikat** (resist-dyed yarn, e.g. Pochampally) and **Chikankari** (embroidery, Lucknow) are Indian textile crafts. Origami is Japanese paper folding.",
      links: [
        wiki("Bandhani", "Bandhani"),
        wiki("Ikat", "Ikat"),
        wiki("Chikankari", "Chikan_(embroidery)"),
      ],
    },
  },
  {
    key: "madhubani",
    subject: "general-knowledge",
    topic: "indian-crafts",
    type: "SINGLE_CHOICE",
    text: "Madhubani painting comes from which state?",
    daily: true,
    options: [
      ["Bihar", true],
      ["Odisha", false],
      ["Gujarat", false],
      ["Kerala", false],
    ],
    explain: {
      text: "Madhubani (Mithila) painting comes from the Mithila region of **Bihar**, known for bold outlines and every space filled with pattern.",
      links: [wiki("Madhubani art", "Madhubani_art")],
    },
  },
  {
    key: "pritzker",
    subject: "general-knowledge",
    topic: "famous-designers",
    type: "SINGLE_CHOICE",
    text: "Which Indian architect won the Pritzker Architecture Prize in 2018?",
    daily: true,
    options: [
      ["B. V. Doshi", true],
      ["Charles Correa", false],
      ["Raj Rewal", false],
      ["Hafeez Contractor", false],
    ],
    explain: {
      text: "**Balkrishna Doshi** was the first Indian to win the Pritzker Prize (2018). His work includes IIM Bangalore and Aranya low-cost housing.",
      links: [wiki("B. V. Doshi", "Balkrishna_Vithaldas_Doshi")],
    },
  },
  {
    key: "transparency",
    subject: "general-knowledge",
    topic: "av-terminology",
    type: "MULTIPLE_CHOICE",
    text: "Which of these image formats can store transparency? Select all that apply.",
    options: [
      ["PNG", true],
      ["GIF", true],
      ["JPEG", false],
      ["MP3", false],
    ],
    explain: {
      text: "**PNG** (full alpha) and **GIF** (one transparent colour) support transparency. JPEG has no transparency, and MP3 is audio.",
      links: [wiki("PNG", "PNG")],
    },
  },
  // Mathematics
  {
    key: "rect-diag",
    subject: "mathematics",
    topic: "mensuration",
    type: "NUMERIC",
    text: "A rectangle is 12 cm long and 5 cm wide. How long is its diagonal, in cm?",
    numeric: [13, 13],
    explain: {
      text: "The diagonal is the hypotenuse of a right triangle: √(12² + 5²) = √169 = **13 cm**.",
      image: "rect-diag",
      links: [wiki("Pythagorean theorem", "Pythagorean_theorem")],
    },
  },
  {
    key: "circle-154",
    subject: "mathematics",
    topic: "mensuration",
    type: "NUMERIC",
    text: "A circle has a diameter of 14 cm. Using π = 22/7, what is its area in cm²?",
    numeric: [154, 154],
    explain: {
      text: "Radius = 14 ÷ 2 = 7 cm. Area = πr² = 22/7 × 7 × 7 = **154 cm²**.",
      steps: [
        ["circle-7", "Halve the diameter to get the radius"],
        ["circle-area", "Apply πr²"],
      ],
      video: true,
    },
  },
  {
    key: "die-gt4",
    subject: "mathematics",
    topic: "probability",
    type: "SINGLE_CHOICE",
    text: "A fair die is rolled once. What is the probability of getting a number greater than 4?",
    options: [
      ["1/3", true],
      ["1/2", false],
      ["1/6", false],
      ["2/3", false],
    ],
    explain: {
      text: "Only 5 and 6 are greater than 4: 2 of 6 equally likely outcomes = 2/6 = **1/3**.",
    },
  },
  {
    key: "arrange-art",
    subject: "mathematics",
    topic: "permutations",
    type: "NUMERIC",
    text: "In how many different ways can the letters of the word ART be arranged?",
    numeric: [6, 6],
    explain: {
      text: "Three different letters: 3! = 3 × 2 × 1 = **6** (ART, ATR, RAT, RTA, TAR, TRA).",
    },
  },
  {
    key: "cuboid-24",
    subject: "mathematics",
    topic: "mensuration",
    type: "NUMERIC",
    text: "A box measures 4 cm × 3 cm × 2 cm. What is its volume in cm³?",
    numeric: [24, 24],
    explain: { text: "Volume = length × breadth × height = 4 × 3 × 2 = **24 cm³**." },
  },
  // English
  {
    key: "spelling",
    subject: "english",
    topic: "grammar",
    type: "SINGLE_CHOICE",
    text: "Choose the correctly spelt word.",
    options: [
      ["Accommodate", true],
      ["Acommodate", false],
      ["Accomodate", false],
      ["Acomodate", false],
    ],
    explain: { text: "**Accommodate** has a double c and a double m." },
  },
  {
    key: "idiom-board",
    subject: "english",
    topic: "idioms",
    type: "SINGLE_CHOICE",
    text: 'What does "back to the drawing board" mean?',
    options: [
      ["To start again after a plan fails", true],
      ["To draw on a blackboard", false],
      ["To return to school", false],
      ["To finish a drawing", false],
    ],
    explain: {
      text: "It means **starting a plan again from the beginning** because the first attempt failed.",
    },
  },
  {
    key: "aesthetic",
    subject: "english",
    topic: "grammar",
    type: "SINGLE_CHOICE",
    text: 'Choose the meaning closest to "aesthetic".',
    options: [
      ["Concerned with beauty and taste", true],
      ["Related to anaesthesia", false],
      ["Very old", false],
      ["Strictly practical", false],
    ],
    explain: {
      text: '**Aesthetic** describes beauty, appearance and taste, e.g. "the aesthetic of a product".',
    },
  },
  // Design & sketching (theory)
  {
    key: "one-point",
    subject: "design-sketching",
    topic: "perspective",
    type: "SINGLE_CHOICE",
    text: "In one-point perspective, lines going into the depth of the scene meet at…",
    options: [
      ["A single vanishing point on the horizon", true],
      ["Two vanishing points", false],
      ["Nowhere: they stay parallel", false],
      ["A point below the ground line", false],
    ],
    explain: {
      text: "In one-point perspective all depth lines converge to **one vanishing point on the horizon line**; horizontals and verticals stay as they are.",
      image: "persp-1",
      links: [wiki("Perspective (graphical)", "Perspective_(graphical)")],
    },
  },
  {
    key: "two-point-vert",
    subject: "design-sketching",
    topic: "perspective",
    type: "SINGLE_CHOICE",
    text: "In two-point perspective, the vertical edges of a building are drawn…",
    options: [
      ["Vertical and parallel to each other", true],
      ["Towards the left vanishing point", false],
      ["Towards the right vanishing point", false],
      ["Towards a point above the horizon", false],
    ],
    explain: {
      text: "Only horizontal edges run to the two vanishing points; **verticals stay vertical**. (Converging verticals would make it three-point perspective.)",
      image: "persp-2",
    },
  },
  {
    key: "hatching",
    subject: "design-sketching",
    topic: "perspective",
    type: "SINGLE_CHOICE",
    text: "Which shading technique uses closely spaced parallel lines?",
    options: [
      ["Hatching", true],
      ["Stippling", false],
      ["Smudging", false],
      ["Scumbling", false],
    ],
    explain: {
      text: "**Hatching** uses parallel lines (cross-hatching layers them at angles). Stippling uses dots; smudging blends with a finger or tool.",
      links: [wiki("Hatching", "Hatching")],
    },
  },
  {
    key: "heads",
    subject: "design-sketching",
    topic: "human-figure",
    type: "SINGLE_CHOICE",
    text: "In figure drawing, an adult is usually drawn about how many heads tall?",
    options: [
      ["About 7½ to 8 heads", true],
      ["About 4 heads", false],
      ["About 5 heads", false],
      ["About 12 heads", false],
    ],
    explain: {
      text: "A realistic adult is about **7½–8 heads** tall (fashion drawings stretch to 9 or more). A small child is about 4–5 heads.",
    },
  },
  {
    key: "iso-tf",
    subject: "design-sketching",
    topic: "perspective",
    type: "TRUE_FALSE",
    text: "True or false: In an isometric drawing, the three axes are drawn 120° apart.",
    options: TF(true),
    explain: {
      text: "**True.** One axis is vertical and the other two are at 30° to the horizontal, so all three are 120° apart.",
      links: [wiki("Isometric projection", "Isometric_projection")],
    },
  },
  {
    key: "secondary-msq",
    subject: "design-sketching",
    topic: "perspective",
    type: "MULTIPLE_CHOICE",
    text: "Which are secondary colours on the traditional (RYB) colour wheel? Select all that apply.",
    options: [
      ["Orange", true],
      ["Green", true],
      ["Violet", true],
      ["Red", false],
    ],
    explain: {
      text: "Mixing two primaries gives a secondary: red + yellow = **orange**, yellow + blue = **green**, blue + red = **violet**. Red is a primary.",
      image: "wheel-secondary",
      links: [wiki("Colour wheel", "Color_wheel")],
    },
  },
  // Sketching (marked by a reviewer)
  {
    key: "sketch-stall",
    subject: "design-sketching",
    topic: "perspective",
    type: "UPLOAD",
    text: "Draw a street-food stall at night as seen by a child standing in front of it. Show the vendor, at least two customers and where the light comes from. Pencil only.",
    criteria: ["Observation", "Composition", "Light and shade", "Proportion", "Detail"],
    explain: {
      text: "Strong answers use a low (child's) eye level, a clear light source with cast shadows, overlapping figures for depth and a few well-observed details (steam, signage, utensils).",
    },
  },
  {
    key: "sketch-bottle",
    subject: "design-sketching",
    topic: "interiors",
    type: "UPLOAD",
    text: "Design a reusable water bottle for trekkers. Draw it from the front, the side and the top, plus one close-up of a detail that makes it easy to use with gloves on.",
    criteria: ["Idea", "Usability", "Drawing clarity", "Proportion", "Presentation"],
    explain: {
      text: "Look for consistent views, a clear user problem (gloves, cold, grip) solved by a visible detail, short labels and neat layout.",
    },
  },
  {
    key: "sketch-gate",
    subject: "design-sketching",
    topic: "perspective",
    type: "UPLOAD",
    text: "From memory, draw the entrance gate of your school with two people walking through it. Use perspective to show depth.",
    criteria: ["Memory and observation", "Perspective", "Composition", "Line quality", "Detail"],
    explain: {
      text: "Good answers place the gate on a clear horizon, scale the people correctly as they recede and add details you actually remember.",
    },
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/** "bank:key", "sample:quiz/i" or "sketch:platform" */
type Item = [ref: string, marks: number, negative?: number | null];

interface TestSpec {
  key: string;
  category: string;
  title: string;
  description: string;
  minutes: number | null;
  maxAttempts: number | null;
  xp: number;
  level?: "EASY" | "MEDIUM" | "HARD";
  unlockAfter?: string;
  sections: { title: string; description: string; items: Item[] }[];
}

const B = (key: string, marks = 1, negative: number | null = 0): Item => [
  `bank:${key}`,
  marks,
  negative,
];
const S = (quiz: string, i: number, marks = 1, negative: number | null = 0): Item => [
  `sample:${quiz}/${i}`,
  marks,
  negative,
];

const UCEED_A =
  "NAT (type a number): 4 marks, no negative marking.\nMSQ (one or more answers): 4 marks, −1 for a wrong answer, no part marks.\nMCQ (one answer): 3 marks, −0.71 for a wrong answer.\nUnanswered questions score 0.";
const nat = (k: string) => B(k, 4, 0);
const msq = (k: string) => B(k, 4, 1);
const mcq = (k: string) => B(k, 3, 0.71);
const UPLOAD_NOTE =
  "Draw on paper, photograph your sketch and upload it. A reviewer marks it on the listed criteria; you can rate yourself and see others' sketches afterwards.";

const NID_CATEGORIES = [
  ["mock-tests", "Mock tests", "Full-length timed tests in exam format."],
  [
    "uceed-mocks",
    "UCEED-style mocks",
    "Part A with typed-number, multiple-select and single-answer questions and UCEED-style marking; Part B is a drawing.",
  ],
  [
    "past-year-questions",
    "Past year questions",
    "Topic-wise sets in the style of previous papers. Untimed: work at your own pace.",
  ],
  [
    "past-paper-style",
    "Past year papers",
    "Full papers following one year's pattern. Practice papers written by Examora, not the official papers.",
  ],
  ["aptitude-test", "Design aptitude test", "Discover which design fields suit your strengths."],
  [
    "predicted-sets",
    "Predicted sets",
    "Short timed sets on topics likely to appear. Sets 4 to 6 unlock in order.",
  ],
  [
    "school-papers",
    "Private design school papers",
    "Sample papers in the style of private design school entrance tests.",
  ],
] as const;

const PREDICTED: Item[][] = [
  [
    B("clock-420"),
    B("series-n2"),
    B("code-cat"),
    B("eames"),
    B("rect-diag"),
    B("one-point"),
    B("spelling"),
    B("cube-adjacent"),
  ],
  [
    B("walk-5"),
    B("seating"),
    B("mondrian"),
    B("die-gt4"),
    B("hatching"),
    B("triangles"),
    B("idiom-board"),
    B("odd-cube"),
  ],
  [
    B("fold-holes"),
    B("series-letters"),
    B("lotus"),
    B("arrange-art"),
    B("heads"),
    B("mirror-p"),
    B("aesthetic"),
    B("syllogism"),
  ],
  [
    B("cube-27", 2),
    B("analogy-knife"),
    B("starry"),
    B("circle-154"),
    B("two-point-vert"),
    B("rot-180"),
    B("tf-tablet"),
    B("ds-x"),
  ],
  [
    B("puz-widgets"),
    B("crafts-msq", 2),
    B("madhubani"),
    B("cuboid-24"),
    B("iso-tf"),
    B("transparency", 2),
    S("clock-puzzles", 0),
    S("number-puzzles", 1),
  ],
  [
    B("pritzker"),
    B("secondary-msq", 2),
    S("blood-relations-quiz", 0),
    S("blood-relations-quiz", 1),
    S("av-terminology-quiz", 3),
    S("av-terminology-quiz", 6),
    B("clock-420"),
    B("cube-27", 2),
  ],
];

const NID_TESTS: TestSpec[] = [
  {
    key: "uceed-mock-1",
    category: "uceed-mocks",
    title: "UCEED-style Mock 1",
    description: "Part A: 16 aptitude questions with UCEED marking. Part B: one drawing.",
    minutes: 90,
    maxAttempts: 3,
    xp: 100,
    sections: [
      {
        title: "Part A: Aptitude",
        description: UCEED_A,
        items: [
          nat("walk-5"),
          nat("fold-holes"),
          nat("cube-27"),
          nat("rect-diag"),
          nat("circle-154"),
          nat("arrange-art"),
          msq("transparency"),
          msq("secondary-msq"),
          mcq("clock-420"),
          mcq("series-n2"),
          mcq("code-cat"),
          mcq("odd-cube"),
          mcq("mondrian"),
          mcq("die-gt4"),
          mcq("rot-180"),
          mcq("one-point"),
        ],
      },
      { title: "Part B: Drawing", description: UPLOAD_NOTE, items: [B("sketch-stall", 50, null)] },
    ],
  },
  {
    key: "uceed-mock-2",
    category: "uceed-mocks",
    title: "UCEED-style Mock 2",
    description: "Unlocks after Mock 1. Same pattern, new questions.",
    minutes: 90,
    maxAttempts: 3,
    xp: 100,
    unlockAfter: "uceed-mock-1",
    sections: [
      {
        title: "Part A: Aptitude",
        description: UCEED_A,
        items: [
          nat("puz-widgets"),
          nat("cube-adjacent"),
          nat("triangles"),
          nat("cuboid-24"),
          msq("crafts-msq"),
          msq("transparency"),
          mcq("seating"),
          mcq("analogy-knife"),
          mcq("series-letters"),
          mcq("eames"),
          mcq("starry"),
          mcq("two-point-vert"),
          mcq("mirror-p"),
          mcq("syllogism"),
        ],
      },
      { title: "Part B: Drawing", description: UPLOAD_NOTE, items: [B("sketch-bottle", 50, null)] },
    ],
  },
  {
    key: "pyq-reasoning",
    category: "past-year-questions",
    title: "Reasoning: previous-year style questions",
    description: "Puzzles, series, coding, directions and logic. Untimed, unlimited attempts.",
    minutes: null,
    maxAttempts: null,
    xp: 20,
    level: "EASY",
    sections: [
      {
        title: "Questions",
        description: "1 mark each, no negative marking.",
        items: [
          B("puz-widgets"),
          B("clock-420"),
          B("series-n2"),
          B("code-cat"),
          B("walk-5"),
          B("seating"),
          B("syllogism"),
          B("tf-tablet"),
          B("ds-x"),
          B("series-letters"),
          S("blood-relations-quiz", 0),
          S("blood-relations-quiz", 1),
          S("blood-relations-quiz", 2),
          S("blood-relations-quiz", 3),
        ],
      },
    ],
  },
  {
    key: "pyq-visual",
    category: "past-year-questions",
    title: "Visual & spatial: previous-year style questions",
    description: "Rotation, mirror images, cubes, paper folding and perspective. Untimed.",
    minutes: null,
    maxAttempts: null,
    xp: 20,
    sections: [
      {
        title: "Questions",
        description: "1 mark each, no negative marking.",
        items: [
          B("rot-180"),
          B("mirror-p"),
          B("cube-adjacent"),
          B("cube-27"),
          B("triangles"),
          B("fold-holes"),
          B("one-point"),
          B("two-point-vert"),
          B("iso-tf"),
          S("rotation-practice", 0),
          S("rotation-practice", 1, 2),
        ],
      },
    ],
  },
  {
    key: "pyq-gk",
    category: "past-year-questions",
    title: "Design GK: previous-year style questions",
    description: "Designers, art movements, crafts and media terms. Untimed.",
    minutes: null,
    maxAttempts: null,
    xp: 20,
    sections: [
      {
        title: "Questions",
        description: "1 mark each (2 for select-all questions), no negative marking.",
        items: [
          B("eames"),
          B("lotus"),
          B("mondrian"),
          B("starry"),
          B("crafts-msq", 2),
          B("madhubani"),
          B("pritzker"),
          B("transparency", 2),
          S("av-terminology-quiz", 4),
          S("av-terminology-quiz", 5),
          S("av-terminology-quiz", 7),
          S("av-terminology-quiz", 9),
        ],
      },
    ],
  },
  {
    key: "paper-nid-2024",
    category: "past-paper-style",
    title: "NID DAT Prelims: 2024 pattern (practice paper)",
    description:
      "Section 1: aptitude, 1 mark each (2 for select-all). Section 2: two drawing questions, 30 marks each.",
    minutes: 120,
    maxAttempts: 2,
    xp: 150,
    level: "HARD",
    sections: [
      {
        title: "Section 1: Aptitude",
        description:
          "Single-answer questions: 1 mark. Select-all questions: 2 marks, with part marks where shown. No negative marking.",
        items: [
          B("clock-420"),
          B("series-letters"),
          B("seating"),
          B("code-cat"),
          B("syllogism"),
          B("rot-180"),
          B("mirror-p"),
          B("cube-27"),
          B("eames"),
          B("lotus"),
          B("crafts-msq", 2),
          B("one-point"),
          B("hatching"),
          B("heads"),
          B("circle-154"),
        ],
      },
      {
        title: "Section 2: Design & drawing",
        description: UPLOAD_NOTE,
        items: [B("sketch-gate", 30, null), B("sketch-bottle", 30, null)],
      },
    ],
  },
  {
    key: "paper-uceed-2024",
    category: "past-paper-style",
    title: "UCEED: 2024 pattern (practice paper)",
    description: "Part A with UCEED marking, Part B drawing.",
    minutes: 180,
    maxAttempts: 2,
    xp: 150,
    level: "HARD",
    sections: [
      {
        title: "Part A",
        description: UCEED_A,
        items: [
          nat("cube-27"),
          nat("walk-5"),
          nat("rect-diag"),
          nat("fold-holes"),
          nat("arrange-art"),
          msq("crafts-msq"),
          msq("secondary-msq"),
          msq("transparency"),
          mcq("clock-420"),
          mcq("rot-180"),
          mcq("mirror-p"),
          mcq("pritzker"),
          mcq("madhubani"),
          mcq("ds-x"),
          mcq("two-point-vert"),
          mcq("spelling"),
        ],
      },
      { title: "Part B", description: UPLOAD_NOTE, items: [B("sketch-stall", 50, null)] },
    ],
  },
  {
    key: "paper-uceed-2023",
    category: "past-paper-style",
    title: "UCEED: 2023 pattern (practice paper)",
    description: "Part A with UCEED marking, Part B drawing.",
    minutes: 180,
    maxAttempts: 2,
    xp: 150,
    sections: [
      {
        title: "Part A",
        description: UCEED_A,
        items: [
          nat("puz-widgets"),
          nat("cube-adjacent"),
          nat("circle-154"),
          nat("cuboid-24"),
          nat("triangles"),
          msq("secondary-msq"),
          msq("transparency"),
          mcq("series-n2"),
          mcq("analogy-knife"),
          mcq("odd-cube"),
          mcq("starry"),
          mcq("mondrian"),
          mcq("one-point"),
          mcq("idiom-board"),
          mcq("aesthetic"),
        ],
      },
      { title: "Part B", description: UPLOAD_NOTE, items: [B("sketch-gate", 50, null)] },
    ],
  },
  {
    key: "aptitude",
    category: "aptitude-test",
    title: "Design Career Aptitude Test",
    description:
      "Three short parts. Your report shows where you are strongest: visual thinking, design awareness or problem solving.",
    minutes: 25,
    maxAttempts: 1,
    xp: 50,
    level: "EASY",
    sections: [
      {
        title: "Visual thinking",
        description: "1 mark each.",
        items: [B("rot-180"), B("mirror-p"), B("fold-holes"), B("cube-adjacent"), B("triangles")],
      },
      {
        title: "Design awareness",
        description: "1 mark each.",
        items: [B("eames"), B("mondrian"), B("hatching"), B("heads"), B("one-point")],
      },
      {
        title: "Problem solving",
        description: "1 mark each.",
        items: [B("puz-widgets"), B("seating"), B("walk-5"), B("ds-x"), B("die-gt4")],
      },
    ],
  },
  ...PREDICTED.map((items, i): TestSpec => ({
    key: `predicted-${i + 1}`,
    category: "predicted-sets",
    title: `Predicted Set ${i + 1}`,
    description: "8 questions on topics likely to appear this year.",
    minutes: 20,
    maxAttempts: 3,
    xp: 50,
    unlockAfter: i >= 3 ? `predicted-${i}` : undefined,
    sections: [
      {
        title: "Questions",
        description: "1 mark each (2 where shown). No negative marking.",
        items,
      },
    ],
  })),
  {
    key: "school-paper-1",
    category: "school-papers",
    title: "Private design school: sample paper 1",
    description: "General ability (GAT) plus a creative ability (CAT) drawing task.",
    minutes: 60,
    maxAttempts: 2,
    xp: 100,
    sections: [
      {
        title: "Part 1: General ability",
        description: "1 mark each, no negative marking.",
        items: [
          B("spelling"),
          B("idiom-board"),
          B("aesthetic"),
          B("die-gt4"),
          B("cuboid-24"),
          B("analogy-knife"),
          B("odd-cube"),
          B("madhubani"),
          B("starry"),
          B("eames"),
        ],
      },
      {
        title: "Part 2: Creative ability",
        description: UPLOAD_NOTE,
        items: [B("sketch-bottle", 30, null)],
      },
    ],
  },
  {
    key: "school-paper-2",
    category: "school-papers",
    title: "Private design school: sample paper 2",
    description: "General ability (GAT) plus a creative ability (CAT) drawing task.",
    minutes: 60,
    maxAttempts: 2,
    xp: 100,
    sections: [
      {
        title: "Part 1: General ability",
        description: "1 mark each, no negative marking.",
        items: [
          B("series-n2"),
          B("code-cat"),
          B("walk-5"),
          B("arrange-art"),
          B("rect-diag"),
          B("lotus"),
          B("pritzker"),
          B("mondrian"),
          B("hatching"),
          B("iso-tf"),
        ],
      },
      {
        title: "Part 2: Creative ability",
        description: UPLOAD_NOTE,
        items: [B("sketch-stall", 30, null)],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Paper details: exam/year, note, section times and perfect-score bonus
// ---------------------------------------------------------------------------

interface TestMeta {
  exam?: string;
  year?: number;
  note?: string;
  bonus?: number;
  /** Total minutes (overrides the spec) and minutes per section, in order. */
  minutes?: number;
  sectionMinutes?: (number | null)[];
}

const paperNote = (exam: string, year: number) =>
  `Practice paper written by Examora in the ${exam} ${year} pattern: same sections, question types and marking; new questions.`;
const uceed = (year: number): TestMeta => ({
  exam: "UCEED",
  year,
  note: paperNote("UCEED", year),
  bonus: 100,
  minutes: 180,
  sectionMinutes: [120, 60],
});
const nid = (year: number): TestMeta => ({
  exam: "NID DAT",
  year,
  note: paperNote("NID DAT Prelims", year),
  bonus: 100,
  minutes: 180,
  sectionMinutes: [100, 80],
});

const TEST_META: Record<string, TestMeta> = {
  "uceed-mock-1": { bonus: 50, sectionMinutes: [60, 30] },
  "uceed-mock-2": { bonus: 50, sectionMinutes: [60, 30] },
  "paper-nid-2024": nid(2024),
  "paper-uceed-2024": uceed(2024),
  "paper-uceed-2023": uceed(2023),
  "paper-uceed-2025": uceed(2025),
  "paper-uceed-2022": uceed(2022),
  "paper-nid-2025": nid(2025),
  "paper-nid-2023": nid(2023),
  "paper-ceed-2024": {
    exam: "CEED",
    year: 2024,
    note: paperNote("CEED", 2024),
    bonus: 100,
    minutes: 180,
    sectionMinutes: [60, 120],
  },
  "school-paper-1": { bonus: 50, sectionMinutes: [30, 30] },
  "school-paper-2": { bonus: 50, sectionMinutes: [30, 30] },
  aptitude: { bonus: 25 },
  "uceed-course-mock-1": { bonus: 50, sectionMinutes: [60, 30] },
  "uceed-course-2024": uceed(2024),
  "nid-course-2024": nid(2024),
  "nift-gat-mock-1": { bonus: 30 },
  ...Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [`predicted-${n}`, { bonus: 25 }])),
};

/** More past papers so the Past year papers tab spans several exams and years. */
const EXTRA_PAPERS: TestSpec[] = [
  {
    key: "paper-uceed-2025",
    category: "past-paper-style",
    title: "UCEED: 2025 pattern (practice paper)",
    description: "Part A with UCEED marking, Part B drawing.",
    minutes: 180,
    maxAttempts: 2,
    xp: 150,
    level: "HARD",
    sections: [
      {
        title: "Part A",
        description: UCEED_A,
        items: [
          nat("cube-27"),
          nat("puz-widgets"),
          nat("rect-diag"),
          nat("arrange-art"),
          msq("crafts-msq"),
          msq("transparency"),
          mcq("seating"),
          mcq("code-cat"),
          mcq("mirror-p"),
          mcq("eames"),
          mcq("lotus"),
          mcq("hatching"),
          mcq("heads"),
          mcq("syllogism"),
        ],
      },
      { title: "Part B", description: UPLOAD_NOTE, items: [B("sketch-bottle", 50, null)] },
    ],
  },
  {
    key: "paper-uceed-2022",
    category: "past-paper-style",
    title: "UCEED: 2022 pattern (practice paper)",
    description: "Part A with UCEED marking, Part B drawing.",
    minutes: 180,
    maxAttempts: 2,
    xp: 150,
    sections: [
      {
        title: "Part A",
        description: UCEED_A,
        items: [
          nat("walk-5"),
          nat("triangles"),
          nat("cuboid-24"),
          nat("fold-holes"),
          msq("secondary-msq"),
          msq("crafts-msq"),
          mcq("series-letters"),
          mcq("odd-cube"),
          mcq("rot-180"),
          mcq("starry"),
          mcq("madhubani"),
          mcq("die-gt4"),
          mcq("aesthetic"),
          mcq("ds-x"),
        ],
      },
      { title: "Part B", description: UPLOAD_NOTE, items: [B("sketch-gate", 50, null)] },
    ],
  },
  {
    key: "paper-nid-2025",
    category: "past-paper-style",
    title: "NID DAT Prelims: 2025 pattern (practice paper)",
    description: "Section 1: aptitude. Section 2: two drawing questions, 30 marks each.",
    minutes: 180,
    maxAttempts: 2,
    xp: 150,
    level: "HARD",
    sections: [
      {
        title: "Section 1: Aptitude",
        description:
          "Single-answer questions: 1 mark. Select-all questions: 2 marks. No negative marking.",
        items: [
          B("puz-widgets"),
          B("series-n2"),
          B("walk-5"),
          B("analogy-knife"),
          B("tf-tablet"),
          B("ds-x"),
          B("cube-adjacent"),
          B("triangles"),
          B("fold-holes"),
          B("mondrian"),
          B("pritzker"),
          B("secondary-msq", 2),
          B("two-point-vert"),
          B("iso-tf"),
          B("arrange-art"),
        ],
      },
      {
        title: "Section 2: Design & drawing",
        description: UPLOAD_NOTE,
        items: [B("sketch-stall", 30, null), B("sketch-bottle", 30, null)],
      },
    ],
  },
  {
    key: "paper-nid-2023",
    category: "past-paper-style",
    title: "NID DAT Prelims: 2023 pattern (practice paper)",
    description: "Section 1: aptitude. Section 2: two drawing questions, 30 marks each.",
    minutes: 180,
    maxAttempts: 2,
    xp: 150,
    sections: [
      {
        title: "Section 1: Aptitude",
        description:
          "Single-answer questions: 1 mark. Select-all questions: 2 marks. No negative marking.",
        items: [
          B("clock-420"),
          B("code-cat"),
          B("seating"),
          B("odd-cube"),
          B("syllogism"),
          B("rot-180"),
          B("cube-27"),
          B("madhubani"),
          B("starry"),
          B("transparency", 2),
          B("one-point"),
          B("hatching"),
          B("rect-diag"),
          B("die-gt4"),
        ],
      },
      {
        title: "Section 2: Design & drawing",
        description: UPLOAD_NOTE,
        items: [B("sketch-gate", 30, null), B("sketch-stall", 30, null)],
      },
    ],
  },
  {
    key: "paper-ceed-2024",
    category: "past-paper-style",
    title: "CEED: 2024 pattern (practice paper)",
    description: "Part A: objective questions with negative marking. Part B: drawing and design.",
    minutes: 180,
    maxAttempts: 2,
    xp: 150,
    level: "HARD",
    sections: [
      {
        title: "Part A",
        description:
          "NAT: 4 marks, no negative marking.\nMSQ: 4 marks, −1 for a wrong answer.\nMCQ: 3 marks, −0.5 for a wrong answer.",
        items: [
          nat("cube-27"),
          nat("circle-154"),
          nat("walk-5"),
          msq("transparency"),
          msq("secondary-msq"),
          B("pritzker", 3, 0.5),
          B("lotus", 3, 0.5),
          B("mondrian", 3, 0.5),
          B("two-point-vert", 3, 0.5),
          B("ds-x", 3, 0.5),
          B("syllogism", 3, 0.5),
        ],
      },
      {
        title: "Part B",
        description: UPLOAD_NOTE,
        items: [B("sketch-bottle", 50, null), B("sketch-gate", 50, null)],
      },
    ],
  },
];

/** Tests for other sample courses, so their Practice pages aren't empty. */
const OTHER_COURSES: {
  title: string;
  categories: [string, string, string][];
  tests: TestSpec[];
}[] = [
  {
    title: "UCEED Complete Preparation",
    categories: [
      ["mock-tests", "Mock tests", "Timed tests in UCEED format."],
      ["past-year-papers", "Past year papers", "Practice papers following a year's pattern."],
    ],
    tests: [
      {
        ...NID_TESTS[0]!,
        key: "uceed-course-mock-1",
        category: "mock-tests",
        unlockAfter: undefined,
      },
      {
        ...NID_TESTS.find((t) => t.key === "paper-uceed-2024")!,
        key: "uceed-course-2024",
        category: "past-year-papers",
      },
    ],
  },
  {
    title: "NID Entrance Preparation Complete Course",
    categories: [
      ["past-year-papers", "Past year papers", "Practice papers following a year's pattern."],
    ],
    tests: [
      {
        ...NID_TESTS.find((t) => t.key === "paper-nid-2024")!,
        key: "nid-course-2024",
        category: "past-year-papers",
      },
    ],
  },
  {
    title: "NIFT Entrance Preparation",
    categories: [["mock-tests", "Mock tests", "General ability tests in NIFT GAT style."]],
    tests: [
      {
        key: "nift-gat-mock-1",
        category: "mock-tests",
        title: "NIFT GAT-style Mock 1",
        description:
          "English, maths, reasoning and general awareness. 1 mark each, −0.25 for a wrong answer.",
        minutes: 30,
        maxAttempts: 3,
        xp: 60,
        sections: [
          {
            title: "General ability",
            description: "1 mark each, −0.25 for a wrong answer.",
            items: [
              B("spelling", 1, 0.25),
              B("idiom-board", 1, 0.25),
              B("aesthetic", 1, 0.25),
              B("die-gt4", 1, 0.25),
              B("cuboid-24", 1, 0),
              B("rect-diag", 1, 0),
              B("series-n2", 1, 0.25),
              B("code-cat", 1, 0.25),
              B("analogy-knife", 1, 0.25),
              B("madhubani", 1, 0.25),
              B("starry", 1, 0.25),
              B("crafts-msq", 2, 0),
            ],
          },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

async function seedBank(prisma: PrismaClient, media: Media, adminId: string): Promise<number> {
  let created = 0;
  for (const [i, q] of BANK.entries()) {
    const id = bankQ(q.key);
    const explain = await explanationData(media, q.explain);
    const imageUrl = q.image ? await media.ref(q.image) : null;
    const exists = await prisma.question.findUnique({ where: { id }, select: { id: true } });
    if (exists) {
      await prisma.question.update({ where: { id }, data: { ...explain, imageUrl } });
      continue;
    }
    const options = await Promise.all(
      (q.options ?? []).map(async ([text, isCorrect, image], o) => ({
        id: sid(`lib-option:${q.key}/${o}`),
        text,
        isCorrect,
        imageUrl: image ? await media.ref(image) : null,
        position: o,
      })),
    );
    await prisma.question.create({
      data: {
        id,
        subjectId: subjectId(q.subject),
        topicId: q.topic ? topicId(q.subject, q.topic) : null,
        type: q.type,
        difficulty: q.difficulty ?? "MEDIUM",
        text: q.text,
        imageUrl,
        numericMin: q.numeric?.[0] ?? null,
        numericMax: q.numeric?.[1] ?? null,
        partialMarking: q.type === "MULTIPLE_CHOICE" && Boolean(q.partial),
        criteria: (q.criteria ?? []) as unknown as Prisma.InputJsonValue,
        tags: ["practice-library", ...(q.daily ? ["daily"] : [])],
        status: "PUBLISHED",
        position: i,
        createdById: adminId,
        ...explain,
        options: { create: options },
      },
    });
    created++;
  }
  return created;
}

/** Fills explanations once (rows the step-images column has never been set on), so admin edits survive reseeding. */
async function backfillExplanations(prisma: PrismaClient, media: Media): Promise<number> {
  const rows = await prisma.question.findMany({
    where: { text: { in: Object.keys(BACKFILL) }, deletedAt: null },
    select: { id: true, text: true, explanationSteps: true },
  });
  let n = 0;
  for (const row of rows) {
    if (row.explanationSteps !== null) continue;
    await prisma.question.update({
      where: { id: row.id },
      data: await explanationData(media, BACKFILL[row.text]!),
    });
    n++;
  }
  return n;
}

function resolveItem(ref: string): string {
  const [kind, rest] = ref.split(":") as [string, string];
  if (kind === "bank") return bankQ(rest);
  if (kind === "sample") {
    const [quiz, i] = rest.split("/") as [string, string];
    return sampleQ(quiz, Number(i));
  }
  if (kind === "sketch") return sid(`question:sketch-${rest}`);
  throw new Error(`Bad item ${ref}`);
}

async function seedTests(
  prisma: PrismaClient,
  adminId: string,
  courseId: string,
  courseKey: string,
  quizSubjectId: string,
  categories: readonly (readonly [string, string, string])[],
  tests: TestSpec[],
): Promise<number> {
  for (const [i, [slug, title, description]] of categories.entries()) {
    await prisma.practiceCategory.upsert({
      where: { courseId_slug: { courseId, slug } },
      update: { title, description, position: i },
      create: {
        id: sid(`practice:${courseKey}/${slug}`),
        courseId,
        title,
        slug,
        description,
        position: i,
      },
    });
  }
  const catIds = new Map(
    (
      await prisma.practiceCategory.findMany({
        where: { courseId },
        select: { id: true, slug: true },
      })
    ).map((c) => [c.slug, c.id]),
  );
  const existingIds = new Set(
    (
      await prisma.question.findMany({
        where: {
          id: {
            in: tests.flatMap((t) =>
              t.sections.flatMap((s) => s.items.map(([r]) => resolveItem(r))),
            ),
          },
        },
        select: { id: true },
      })
    ).map((q) => q.id),
  );

  let created = 0;
  for (const [pos, t] of tests.entries()) {
    const quizId = sid(`quiz:${courseKey}/${t.key}`);
    const m = TEST_META[t.key] ?? {};
    const sectionTime = (i: number) => m.sectionMinutes?.[i] ?? null;
    if (await prisma.quiz.findUnique({ where: { id: quizId }, select: { id: true } })) {
      await prisma.quiz.update({
        where: { id: quizId },
        data: {
          exam: m.exam ?? null,
          paperYear: m.year ?? null,
          note: m.note ?? null,
          perfectBonusXp: m.bonus ?? 0,
          ...(m.minutes ? { timeLimitMinutes: m.minutes } : {}),
        },
      });
      for (const i of t.sections.keys()) {
        await prisma.quizSection.updateMany({
          where: { id: sid(`section:${courseKey}/${t.key}/${i}`) },
          data: { timeLimitMinutes: sectionTime(i) },
        });
      }
      continue;
    }
    const unlock = t.unlockAfter ? sid(`quiz:${courseKey}/${t.unlockAfter}`) : null;
    await prisma.quiz.create({
      data: {
        id: quizId,
        subjectId: quizSubjectId,
        practiceCategoryId: catIds.get(t.category) ?? null,
        unlockAfterQuizId: unlock,
        requireAllVisited: false,
        title: t.title,
        slug: `${courseKey}-${t.key}`,
        description: t.description,
        timeLimitMinutes: m.minutes ?? t.minutes,
        maxAttempts: t.maxAttempts,
        exam: m.exam ?? null,
        paperYear: m.year ?? null,
        note: m.note ?? null,
        perfectBonusXp: m.bonus ?? 0,
        xpReward: t.xp,
        level: t.level ?? "MEDIUM",
        position: pos,
        status: "PUBLISHED",
        publishedAt: new Date(),
        createdById: adminId,
        sections: {
          create: t.sections.map((s, i) => ({
            id: sid(`section:${courseKey}/${t.key}/${i}`),
            title: s.title,
            description: s.description,
            position: i,
            timeLimitMinutes: sectionTime(i),
          })),
        },
      },
    });
    const rows: Prisma.QuizQuestionCreateManyInput[] = [];
    t.sections.forEach((s, si) =>
      s.items.forEach(([ref, marks, negative]) => {
        const questionId = resolveItem(ref);
        if (!existingIds.has(questionId)) return;
        rows.push({
          id: sid(`quiz-question:${courseKey}/${t.key}/${rows.length}`),
          quizId,
          questionId,
          sectionId: sid(`section:${courseKey}/${t.key}/${si}`),
          marks,
          negativeMarks: negative ?? null,
          position: rows.length,
        });
      }),
    );
    await prisma.quizQuestion.createMany({ data: rows, skipDuplicates: true });
    created++;
  }
  return created;
}

// ---------------------------------------------------------------------------
// Sketch rating sets and a demo workspace (test upload + one revision)
// ---------------------------------------------------------------------------

/** Factor names match each question's existing criteria so earlier ratings still line up. */
const RUBRICS: { key: string; title: string; questions: string[]; factors: [string, string][] }[] =
  [
    {
      key: "observation",
      title: "Observation drawing",
      questions: [sid("question:sketch-platform")],
      factors: [
        ["Observation", "Shows people, objects and details you would really see in the scene."],
        ["Composition", "Arranges the scene so the eye goes to the main subject first."],
        [
          "Perspective",
          "Uses a consistent eye level and vanishing points; sizes shrink with distance.",
        ],
        ["Line quality", "Confident lines with varied weight; little scribbling or erasing."],
        ["Detail", "Small, telling details (signs, bags, shadows) that make the scene believable."],
      ],
    },
    {
      key: "scene",
      title: "Scene drawing",
      questions: [bankQ("sketch-stall")],
      factors: [
        ["Observation", "Captures the people and objects of the scene as they would really look."],
        ["Composition", "A clear focal point and a balanced arrangement of figures."],
        [
          "Light and shade",
          "A clear light source, with cast shadows and highlights that agree with it.",
        ],
        ["Proportion", "Figures and objects are the right size relative to each other."],
        ["Detail", "Specific details that tell the story of the place."],
      ],
    },
    {
      key: "design-aptitude",
      title: "Design aptitude",
      questions: [bankQ("sketch-bottle")],
      factors: [
        ["Idea", "A clear idea that answers the brief, not just a restyled existing product."],
        ["Usability", "The design solves the user's actual problem (here: use with gloves)."],
        ["Drawing clarity", "Views are consistent and easy to read."],
        ["Proportion", "Parts are sized sensibly relative to each other and to the hand."],
        ["Presentation", "Neat layout, short labels, and the key detail is easy to find."],
      ],
    },
    {
      key: "memory",
      title: "Memory drawing",
      questions: [bankQ("sketch-gate")],
      factors: [
        ["Memory and observation", "Includes details you actually remember about the place."],
        ["Perspective", "A believable depth with a consistent horizon and vanishing points."],
        ["Composition", "The gate and the two people are placed with a clear focus."],
        ["Line quality", "Clean, confident lines with varied weight."],
        ["Detail", "Textures, signs and small objects that make it feel real."],
      ],
    },
  ];

async function seedRubrics(prisma: PrismaClient): Promise<number> {
  for (const r of RUBRICS) {
    const id = sid(`sketch-rubric:${r.key}`);
    const factors = r.factors.map(([title, description]) => ({ title, description }));
    await prisma.sketchRubric.upsert({
      where: { id },
      create: { id, title: r.title, factors: factors as unknown as Prisma.InputJsonValue },
      update: { title: r.title, factors: factors as unknown as Prisma.InputJsonValue },
    });
    await prisma.question.updateMany({
      where: { id: { in: r.questions } },
      data: {
        rubricId: id,
        criteria: factors.map((x) => x.title) as unknown as Prisma.InputJsonValue,
      },
    });
  }
  return RUBRICS.length;
}

/** The demo student's Mock Test 1 sketch as a workspace: test upload + a revision with feedback. */
async function seedDemoWorkspace(
  prisma: PrismaClient,
  media: Media,
  studentId: string,
  mentorId: string,
): Promise<boolean> {
  const questionId = sid("question:sketch-platform");
  const answer = await prisma.quizAttemptAnswer.findFirst({
    where: {
      questionId,
      uploadAssetId: { not: null },
      attempt: { userId: studentId, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
    },
    select: { id: true, uploadAssetId: true, answeredAt: true },
  });
  const revisionRef = await media.ref("persp-1");
  if (!answer || !revisionRef) return false;
  const workId = sid("sketch-work:demo");
  await prisma.sketchWork.upsert({
    where: { userId_questionId: { userId: studentId, questionId } },
    create: { id: workId, userId: studentId, questionId },
    update: {},
  });
  const work = await prisma.sketchWork.findUniqueOrThrow({
    where: { userId_questionId: { userId: studentId, questionId } },
    select: { id: true },
  });
  const existingTest = await prisma.sketchVersion.findUnique({
    where: { answerId: answer.id },
    select: { id: true },
  });
  if (!existingTest) {
    await prisma.sketchVersion.create({
      data: {
        id: sid("sketch-version:demo/test"),
        workId: work.id,
        kind: "TEST",
        answerId: answer.id,
        assetId: answer.uploadAssetId!,
        description: "Drawn in the test: bus terminus from the first floor.",
        ...(answer.answeredAt ? { createdAt: answer.answeredAt } : {}),
      },
    });
  }
  const revisionId = sid("sketch-version:demo/rev1");
  await prisma.sketchVersion.upsert({
    where: { id: revisionId },
    create: {
      id: revisionId,
      workId: work.id,
      kind: "REVISION",
      assetId: revisionRef.replace("media:", ""),
      description:
        "Revision 1: rebuilt the perspective around a single vanishing point, as the reviewer suggested.",
    },
    update: {},
  });
  await prisma.sketchComment.upsert({
    where: { id: sid("sketch-pin:demo/rev1") },
    create: {
      id: sid("sketch-pin:demo/rev1"),
      versionId: revisionId,
      authorId: mentorId,
      x: 0.5,
      y: 0.37,
      body: "Much better: everything now meets at this vanishing point.",
    },
    update: {},
  });
  await prisma.sketchWorkComment.upsert({
    where: { id: sid("sketch-work-comment:demo/1") },
    create: {
      id: sid("sketch-work-comment:demo/1"),
      workId: work.id,
      authorId: mentorId,
      body: "Good progress between the test sketch and revision 1. Next, add people at three depths to show scale.",
    },
    update: {},
  });
  const others = await prisma.user.findMany({
    where: { id: { not: studentId }, roles: { some: { role: { name: "STUDENT" } } } },
    select: { id: true },
    take: 3,
    orderBy: { createdAt: "asc" },
  });
  for (const [i, o] of others.entries()) {
    await prisma.sketchWorkView.upsert({
      where: { workId_viewerId: { workId: work.id, viewerId: o.id } },
      create: { workId: work.id, viewerId: o.id },
      update: {},
    });
    if (i < 2) {
      await prisma.sketchClap.upsert({
        where: { workId_userId: { workId: work.id, userId: o.id } },
        create: { workId: work.id, userId: o.id },
        update: {},
      });
    }
  }
  return true;
}

/** Classmates' sketches for Mock Test 1's sketch question, so the community grid has content. */
async function seedSketchCommunity(
  prisma: PrismaClient,
  media: Media,
  studentId: string,
): Promise<number> {
  const questionId = sid("question:sketch-platform");
  const factors = RUBRICS.find((r) => r.key === "observation")!.factors.map(([t]) => t);
  const attempts = await prisma.quizAttempt.findMany({
    where: {
      quizId: sid("quiz:mock-test-1"),
      userId: { not: studentId },
      status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] },
      user: { email: { endsWith: "@bulk.examora.test" } },
    },
    orderBy: { startedAt: "asc" },
    take: 6,
    select: { id: true, userId: true, submittedAt: true },
  });
  const owners = attempts.map((a) => a.userId);
  let n = 0;
  for (const [i, a] of attempts.entries()) {
    const k = i + 1;
    const testRef = await media.ref(`peer-sketch-${k}`);
    if (!testRef) return n;
    const answer = await prisma.quizAttemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId: a.id, questionId } },
      create: {
        attemptId: a.id,
        questionId,
        selectedOptionIds: [],
        uploadAssetId: testRef.replace("media:", ""),
        answeredAt: a.submittedAt ?? new Date(),
        visitedAt: a.submittedAt ?? new Date(),
      },
      update: {},
      select: { id: true, uploadAssetId: true },
    });
    if (!answer.uploadAssetId) continue;
    const work = await prisma.sketchWork.upsert({
      where: { userId_questionId: { userId: a.userId, questionId } },
      create: { id: sid(`sketch-work:peer/${k}`), userId: a.userId, questionId },
      update: {},
      select: { id: true },
    });
    const testVersionId = sid(`sketch-version:peer/${k}/test`);
    const existingTest = await prisma.sketchVersion.findUnique({
      where: { answerId: answer.id },
      select: { id: true },
    });
    const testId = existingTest?.id ?? testVersionId;
    if (!existingTest) {
      await prisma.sketchVersion.create({
        data: {
          id: testVersionId,
          workId: work.id,
          kind: "TEST",
          answerId: answer.id,
          assetId: answer.uploadAssetId,
        },
      });
    }
    // Every classmate rated their own test upload (unlocks the grid for them).
    const selfScores = Object.fromEntries(factors.map((f, j) => [f, 2 + ((k + j) % 4)]));
    await prisma.sketchVersionRating.upsert({
      where: { versionId_raterId: { versionId: testId, raterId: a.userId } },
      create: { versionId: testId, raterId: a.userId, kind: "SELF", scores: selfScores },
      update: {},
    });
    await prisma.sketchReview.upsert({
      where: { answerId: answer.id },
      create: { answerId: answer.id, selfScores, selfRatedAt: new Date() },
      update: {},
    });
    // Half of them uploaded a revision; two are left waiting for reviewer feedback.
    let latestId = testId;
    if (k % 2 === 0) {
      const revRef = await media.ref(`peer-sketch-${k}-rev`);
      if (revRef) {
        const revId = sid(`sketch-version:peer/${k}/rev1`);
        await prisma.sketchVersion.upsert({
          where: { id: revId },
          create: {
            id: revId,
            workId: work.id,
            kind: "REVISION",
            assetId: revRef.replace("media:", ""),
            description: "Revision 1: firmer lines, people at three depths and shadows under them.",
          },
          update: {},
        });
        latestId = revId;
      }
    }
    // Feedback, claps and views from the other classmates.
    for (const [j, rater] of owners.entries()) {
      if (rater === a.userId) continue;
      if ((j + k) % 2 === 0) {
        await prisma.sketchPeerFeedback.upsert({
          where: { versionId_raterId: { versionId: latestId, raterId: rater } },
          create: {
            versionId: latestId,
            raterId: rater,
            likedFactors: factors.filter((_, x) => (x + j + k) % 3 !== 0),
            comment:
              j % 3 === 0 ? "The vanishing point works well. Try varying line weight more." : null,
            xpAwarded: false,
          },
          update: {},
        });
      }
      await prisma.sketchWorkView.upsert({
        where: { workId_viewerId: { workId: work.id, viewerId: rater } },
        create: { workId: work.id, viewerId: rater },
        update: {},
      });
      if ((j * k) % 3 === 0) {
        await prisma.sketchClap.upsert({
          where: { workId_userId: { workId: work.id, userId: rater } },
          create: { workId: work.id, userId: rater },
          update: {},
        });
      }
    }
    n++;
  }
  return n;
}

export async function seedPracticeLibrary(
  prisma: PrismaClient,
  ids: { adminId: string; studentId: string; mentorId: string },
): Promise<string> {
  const adminId = ids.adminId;
  const media = new Media(prisma, adminId);
  const bank = await seedBank(prisma, media, adminId);
  const backfilled = await backfillExplanations(prisma, media);
  const rubrics = await seedRubrics(prisma);
  const workspace = await seedDemoWorkspace(prisma, media, ids.studentId, ids.mentorId);
  const peers = await seedSketchCommunity(prisma, media, ids.studentId);

  let tests = 0;
  const nid = await prisma.course.findUnique({ where: { id: NID_COURSE }, select: { id: true } });
  if (nid) {
    tests += await seedTests(
      prisma,
      adminId,
      NID_COURSE,
      "nid",
      subjectId("mental-ability"),
      NID_CATEGORIES,
      [...NID_TESTS, ...EXTRA_PAPERS],
    );
  }
  for (const c of OTHER_COURSES) {
    const course = await prisma.course.findFirst({
      where: { title: c.title, deletedAt: null },
      select: { id: true, slug: true },
    });
    if (!course) continue;
    const subject = await prisma.subject.findFirst({
      where: { courseId: course.id, deletedAt: null },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    if (!subject) continue;
    tests += await seedTests(
      prisma,
      adminId,
      course.id,
      course.slug,
      subject.id,
      c.categories,
      c.tests,
    );
  }
  return `${bank} new library questions, ${backfilled} explanations added, ${tests} new practice tests, ${rubrics} rating sets${workspace ? ", demo sketch workspace" : ""}, ${peers} classmate sketches`;
}
