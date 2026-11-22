/**
 * Bulk / volume test data — an OPTIONAL layer on top of the regular demo seed
 * (`seed.ts`). Where `seed.ts` gives one clean example of everything, this
 * fills every module with hundreds of interconnected, realistic rows spread
 * over the last ~6 months, plus deliberate edge cases, so pagination,
 * filters, dashboards, analytics, reviewer queues and empty/odd states can be
 * tested properly.
 *
 *   pnpm db:seed:bulk                 # medium (default): ~200 students
 *   pnpm db:seed:bulk:large           # ~1000 students
 *   SEED_SCALE=small pnpm db:seed:bulk
 *   pnpm db:seed:bulk:clean           # removes everything this script created
 *
 * Design rules:
 *   - Deterministic: every id comes from a stable label and every random
 *     choice from a PRNG seeded per entity, so re-running never duplicates
 *     anything (`createMany({ skipDuplicates: true })`) and the same scale
 *     always produces the same data.
 *   - Fully removable: bulk users live on @bulk.examora.test, bulk content
 *     uses `bulk-` slugs / `BULK` codes / a `bulkSeed` marker, and `--clean`
 *     deletes exactly that — the base demo data is never touched.
 *   - Consistent with the API's business rules: published reviews score every
 *     rubric criterion, PAID orders have a captured payment + invoice, paid
 *     course progress only exists with an enrollment, reputation totals equal
 *     the ledger, coupon redemption counts equal paid orders, etc.
 *   - "CLEAN" submission files are only recorded when the bytes were really
 *     uploaded to S3/MinIO (same rule as seed.ts) so every downloadable file
 *     actually downloads. PENDING / FAILED / INFECTED files never have a
 *     downloadable object, so those rows are always created.
 *   - Never runs with NODE_ENV=production.
 */
import { createHash } from "node:crypto";
import { HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import * as argon2 from "argon2";
import { Prisma, PrismaClient } from "../generated/client/index.js";
import { deterministicUuid } from "./seed-id.js";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

type Scale = "small" | "medium" | "large";
const SCALES: Record<
  Scale,
  { students: number; mentors: number; reviewers: number; guardians: number; admins: number }
> = {
  small: { students: 40, mentors: 4, reviewers: 2, guardians: 6, admins: 1 },
  medium: { students: 200, mentors: 10, reviewers: 4, guardians: 25, admins: 2 },
  large: { students: 1000, mentors: 40, reviewers: 12, guardians: 120, admins: 3 },
};

const BULK_DOMAIN = "bulk.examora.test";
const REVIEWER_LOGIN = "reviewer@examora.test";
const GUARDIAN_LOGIN = "guardian@examora.test";
const AUDIT_CORRELATION_ID = "bulk-seed";

// ---------------------------------------------------------------------------
// Deterministic ids + randomness
// ---------------------------------------------------------------------------

function hex(label: string): string {
  return createHash("md5").update(`examora-bulk-seed:${label}`).digest("hex");
}

/** Stable, valid v4 UUID for a label — same label, same id, on every run. */
function bid(label: string): string {
  return deterministicUuid("examora-bulk-seed", label);
}

type Rng = () => number;

/** mulberry32 PRNG seeded from a label — each entity gets its own stream. */
function rng(label: string): Rng {
  let a = parseInt(hex(label).slice(0, 8), 16);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (r: Rng, min: number, max: number): number => min + Math.floor(r() * (max - min + 1));
const chance = (r: Rng, p: number): boolean => r() < p;
const pick = <T>(r: Rng, items: readonly T[]): T => items[Math.floor(r() * items.length)]!;

function weighted<T>(r: Rng, entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = r() * total;
  for (const [value, w] of entries) {
    roll -= w;
    if (roll < 0) return value;
  }
  return entries[entries.length - 1]![0];
}

function shuffle<T>(r: Rng, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

const sample = <T>(r: Rng, items: readonly T[], n: number): T[] => shuffle(r, items).slice(0, n);
const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));
const round2 = (v: number): number => Math.round(v * 100) / 100;

// ---------------------------------------------------------------------------
// Time helpers — everything is relative to the moment the seed runs.
// ---------------------------------------------------------------------------

const NOW = Date.now();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const at = (ms: number): Date => new Date(ms);
const daysAgo = (d: number): Date => at(NOW - d * DAY);
const daysAhead = (d: number): Date => at(NOW + d * DAY);
const notFuture = (d: Date): Date => (d.getTime() > NOW ? at(NOW) : d);
const later = (a: Date, b: Date): Date => (a.getTime() > b.getTime() ? a : b);
const earlier = (a: Date, b: Date): Date => (a.getTime() < b.getTime() ? a : b);
const plus = (d: Date, ms: number): Date => at(d.getTime() + ms);

/** Random moment in [start, end]; collapses to `start` for an empty window. */
function between(r: Rng, start: Date, end: Date): Date {
  const s = start.getTime();
  const e = end.getTime();
  return e <= s ? at(s) : at(s + r() * (e - s));
}

// ---------------------------------------------------------------------------
// Batched insert helper with a running tally for the summary.
// ---------------------------------------------------------------------------

const tally = new Map<string, number>();

async function insert<T>(
  name: string,
  rows: T[],
  create: (data: T[]) => Prisma.PrismaPromise<Prisma.BatchPayload>,
): Promise<void> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 1000) {
    inserted += (await create(rows.slice(i, i + 1000))).count;
  }
  tally.set(name, (tally.get(name) ?? 0) + inserted);
}

function log(message: string): void {
  // eslint-disable-next-line no-console -- seed script CLI output, not application logging
  console.log(message);
}

// ---------------------------------------------------------------------------
// Static text pools
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  "Aarav",
  "Ananya",
  "Vihaan",
  "Diya",
  "Arjun",
  "Ishita",
  "Kabir",
  "Meera",
  "Rohan",
  "Saanvi",
  "Aditya",
  "Kavya",
  "Reyansh",
  "Myra",
  "Vivaan",
  "Aanya",
  "Krishna",
  "Riya",
  "Siddharth",
  "Tara",
  "Nikhil",
  "Pooja",
  "Rahul",
  "Sneha",
  "Farhan",
  "Zara",
  "Imran",
  "Ayesha",
  "Gurpreet",
  "Harleen",
  "Arnav",
  "Nisha",
  "Karthik",
  "Lakshmi",
  "Rajesh",
  "Divya",
  "Tenzin",
  "Priya",
  "Manish",
  "Anjali",
  "Emma",
  "Liam",
  "Sofia",
  "Mateo",
  "Yuki",
  "Chen",
  "Amara",
  "Noah",
] as const;

const LAST_NAMES = [
  "Sharma",
  "Verma",
  "Patel",
  "Iyer",
  "Reddy",
  "Nair",
  "Gupta",
  "Singh",
  "Khan",
  "Das",
  "Mehta",
  "Joshi",
  "Kapoor",
  "Chopra",
  "Banerjee",
  "Mukherjee",
  "Rao",
  "Pillai",
  "Menon",
  "Kulkarni",
  "Deshmukh",
  "Bose",
  "Sethi",
  "Malhotra",
  "Fernandes",
  "D'Souza",
  "Agarwal",
  "Bhatt",
  "Chauhan",
  "Saxena",
  "Garcia",
  "Kim",
  "Tanaka",
  "Okafor",
  "Müller",
  "Rossi",
] as const;

/** Student index -> deliberately awkward names, to test rendering/truncation. */
const EDGE_CASE_NAMES: Record<number, [string | null, string | null]> = {
  5: ["Venkata Satya Narayana Subrahmanya", "Ramachandran-Krishnamurthy Iyengar"],
  6: ["Zoë", "Ñúñez-O'Connor"],
  7: ["Prince", null],
  8: ["अनन्या", "शर्मा"],
  9: [null, null],
};

const SPECIALIZATIONS = [
  "Fashion Design",
  "Textile Design",
  "Architecture",
  "Interior Design",
  "Product Design",
  "Communication Design",
  "Entrance Exam Strategy",
  "Portfolio Development",
] as const;

interface PoolQuestion {
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  text: string;
  explanation: string;
  options: [string, boolean][];
}

const TF = (correct: boolean): [string, boolean][] => [
  ["True", correct],
  ["False", !correct],
];

const QUESTION_POOL: PoolQuestion[] = [
  {
    type: "SINGLE_CHOICE",
    difficulty: "EASY",
    text: "Which of these is a primary colour in the traditional RYB colour model?",
    explanation: "Red, yellow and blue are the RYB primaries.",
    options: [
      ["Red", true],
      ["Green", false],
      ["Orange", false],
      ["Purple", false],
    ],
  },
  {
    type: "SINGLE_CHOICE",
    difficulty: "MEDIUM",
    text: "Complementary colours sit ____ on the colour wheel.",
    explanation: "Complements are directly opposite each other.",
    options: [
      ["Opposite each other", true],
      ["Next to each other", false],
      ["Three steps apart", false],
      ["In the same quadrant", false],
    ],
  },
  {
    type: "TRUE_FALSE",
    difficulty: "EASY",
    text: "Analogous colour schemes use colours that are adjacent on the colour wheel.",
    explanation: "Analogous = neighbours on the wheel.",
    options: TF(true),
  },
  {
    type: "SINGLE_CHOICE",
    difficulty: "MEDIUM",
    text: "In one-point perspective, lines receding from the viewer converge at:",
    explanation: "One-point perspective has a single vanishing point on the horizon.",
    options: [
      ["A single vanishing point", true],
      ["Two vanishing points", false],
      ["The edges of the picture plane", false],
      ["Nowhere — they stay parallel", false],
    ],
  },
  {
    type: "MULTIPLE_CHOICE",
    difficulty: "HARD",
    text: "Which of the following are principles of design? (Select all that apply)",
    explanation: "Texture is an element of design, not a principle.",
    options: [
      ["Balance", true],
      ["Rhythm", true],
      ["Emphasis", true],
      ["Texture", false],
    ],
  },
  {
    type: "SINGLE_CHOICE",
    difficulty: "EASY",
    text: "Which fibre is obtained from the cocoon of a silkworm?",
    explanation: "Silk is a protein fibre spun by silkworms.",
    options: [
      ["Silk", true],
      ["Linen", false],
      ["Cotton", false],
      ["Jute", false],
    ],
  },
  {
    type: "SINGLE_CHOICE",
    difficulty: "MEDIUM",
    text: "A fashion croquis is typically drawn roughly how many heads tall?",
    explanation: "Fashion figures are elongated to about nine heads.",
    options: [
      ["6 heads", false],
      ["7 heads", false],
      ["9 heads", true],
      ["12 heads", false],
    ],
  },
  {
    type: "TRUE_FALSE",
    difficulty: "MEDIUM",
    text: "Linen is a synthetic fibre.",
    explanation: "Linen comes from the flax plant — it is a natural fibre.",
    options: TF(false),
  },
  {
    type: "SINGLE_CHOICE",
    difficulty: "MEDIUM",
    text: "Which typeface category has small strokes attached to the ends of letters?",
    explanation: "Those strokes are serifs.",
    options: [
      ["Serif", true],
      ["Sans-serif", false],
      ["Monospace", false],
      ["Script", false],
    ],
  },
  {
    type: "SINGLE_CHOICE",
    difficulty: "HARD",
    text: "The golden ratio is approximately:",
    explanation: "φ ≈ 1.618.",
    options: [
      ["1.618", true],
      ["1.414", false],
      ["3.142", false],
      ["2.718", false],
    ],
  },
  {
    type: "MULTIPLE_CHOICE",
    difficulty: "MEDIUM",
    text: "Which of these are warm colours? (Select all that apply)",
    explanation: "Blue is a cool colour.",
    options: [
      ["Red", true],
      ["Orange", true],
      ["Yellow", true],
      ["Blue", false],
    ],
  },
  {
    type: "SINGLE_CHOICE",
    difficulty: "EASY",
    text: "In architectural drawings, a 'plan' shows the building as seen from:",
    explanation: "A plan is a horizontal section viewed from above.",
    options: [
      ["Above", true],
      ["The front", false],
      ["The side", false],
      ["Below", false],
    ],
  },
  {
    type: "SINGLE_CHOICE",
    difficulty: "MEDIUM",
    text: "At a scale of 1:100, 1 cm on the drawing represents:",
    explanation: "100 cm = 1 m.",
    options: [
      ["1 m", true],
      ["10 cm", false],
      ["10 m", false],
      ["100 mm", false],
    ],
  },
  {
    type: "TRUE_FALSE",
    difficulty: "EASY",
    text: "Negative space is the area around and between the subject of an image.",
    explanation: "That is the definition of negative space.",
    options: TF(true),
  },
  {
    type: "SINGLE_CHOICE",
    difficulty: "HARD",
    text: "Which weave produces the diagonal rib seen in denim?",
    explanation: "Denim is a twill weave.",
    options: [
      ["Twill", true],
      ["Plain", false],
      ["Satin", false],
      ["Basket", false],
    ],
  },
  {
    type: "MULTIPLE_CHOICE",
    difficulty: "HARD",
    text: "Which of these are additive (light) primary colours? (Select all that apply)",
    explanation: "RGB are the additive primaries; yellow is a subtractive primary.",
    options: [
      ["Red", true],
      ["Green", true],
      ["Blue", true],
      ["Yellow", false],
    ],
  },
  {
    type: "SINGLE_CHOICE",
    difficulty: "MEDIUM",
    text: "Which Gestalt principle explains why we group objects that are close together?",
    explanation: "Proximity.",
    options: [
      ["Proximity", true],
      ["Similarity", false],
      ["Closure", false],
      ["Continuity", false],
    ],
  },
  {
    type: "TRUE_FALSE",
    difficulty: "MEDIUM",
    text: "In standard two-point perspective, vertical lines also converge to a vanishing point.",
    explanation:
      "Verticals stay vertical in two-point perspective (they converge only in three-point).",
    options: TF(false),
  },
  {
    type: "SINGLE_CHOICE",
    difficulty: "EASY",
    text: "Which tool is used to transfer pattern markings onto fabric?",
    explanation: "A tracing wheel with carbon paper transfers markings.",
    options: [
      ["Tracing wheel", true],
      ["Seam ripper", false],
      ["Bodkin", false],
      ["Thimble", false],
    ],
  },
  {
    type: "SINGLE_CHOICE",
    difficulty: "MEDIUM",
    text: "Hue, value and ____ are the three properties of colour.",
    explanation: "Saturation (chroma) is the third property.",
    options: [
      ["Saturation", true],
      ["Contrast", false],
      ["Texture", false],
      ["Line", false],
    ],
  },
  {
    type: "SINGLE_CHOICE",
    difficulty: "HARD",
    text: "Who prepared the master plan of Chandigarh?",
    explanation: "Le Corbusier led the Chandigarh master plan.",
    options: [
      ["Le Corbusier", true],
      ["Frank Lloyd Wright", false],
      ["B. V. Doshi", false],
      ["Zaha Hadid", false],
    ],
  },
  {
    type: "MULTIPLE_CHOICE",
    difficulty: "MEDIUM",
    text: "Which of these are elements of design? (Select all that apply)",
    explanation: "Unity is a principle, not an element.",
    options: [
      ["Line", true],
      ["Shape", true],
      ["Colour", true],
      ["Unity", false],
    ],
  },
  {
    type: "TRUE_FALSE",
    difficulty: "HARD",
    text: "A bias cut cuts fabric at 45° to the grain, giving it more stretch and drape.",
    explanation: "True — bias-cut garments drape fluidly.",
    options: TF(true),
  },
  {
    type: "SINGLE_CHOICE",
    difficulty: "MEDIUM",
    text: "In isometric projection, the three axes are drawn at what angle to each other?",
    explanation: "120° between each pair of axes.",
    options: [
      ["120°", true],
      ["90°", false],
      ["45°", false],
      ["60°", false],
    ],
  },
];

interface AssignmentSpec {
  key: string;
  title: string;
  brief: string;
  criteria: [string, number][];
}

const ASSIGNMENT_SPECS: AssignmentSpec[] = [
  {
    key: "moodboard",
    title: "Mood Board",
    brief:
      "Build a mood board that communicates a clear creative direction. Include a colour palette, texture references and a one-paragraph rationale.",
    criteria: [
      ["Concept clarity", 10],
      ["Visual cohesion", 10],
      ["Rationale", 5],
    ],
  },
  {
    key: "sketch-series",
    title: "Sketch Series: Observational Drawing",
    brief:
      "Complete eight observational sketches of everyday objects from different angles. Focus on line quality and proportion.",
    criteria: [
      ["Line quality", 10],
      ["Proportion & perspective", 10],
      ["Variety", 5],
    ],
  },
  {
    key: "case-study",
    title: "Design Case Study",
    brief:
      "Pick a product, space or garment you admire and analyse why it works: users, context, materials and form. Present as a 4–6 page PDF.",
    criteria: [
      ["Research depth", 10],
      ["Insight", 10],
      ["Presentation", 10],
    ],
  },
  {
    key: "material-board",
    title: "Material Exploration Board",
    brief:
      "Collect and document at least 12 material samples, noting texture, weight, behaviour and possible uses.",
    criteria: [
      ["Material range", 8],
      ["Documentation", 7],
    ],
  },
  {
    key: "value-scale",
    title: "Colour Study: 12-Step Value Scale",
    brief: "Paint a 12-step value scale for two hues and one neutral. Photograph under daylight.",
    criteria: [
      ["Accuracy", 10],
      ["Craft", 5],
    ],
  },
  {
    key: "concept-sketches",
    title: "Concept Sketches: Three Directions",
    brief:
      "Develop three clearly different concept directions for the same brief, with annotations explaining each.",
    criteria: [
      ["Ideation", 10],
      ["Differentiation", 10],
      ["Annotation", 5],
      ["Craft", 5],
    ],
  },
  {
    key: "spatial-model",
    title: "Spatial Model Photo Study",
    brief:
      "Build a small paper or card model exploring light and enclosure. Submit 4–6 photographs and a short note.",
    criteria: [
      ["Form", 10],
      ["Scale & proportion", 10],
      ["Photography", 5],
    ],
  },
  {
    key: "portfolio-spread",
    title: "Portfolio Spread",
    brief: "Design a two-page portfolio spread presenting one project from brief to outcome.",
    criteria: [
      ["Layout", 10],
      ["Narrative", 10],
      ["Typography", 5],
    ],
  },
  {
    key: "situation-test",
    title: "Situation Test Practice",
    brief:
      "Using only the materials listed in the brief, build a 3D composition on the theme 'Celebration' in 90 minutes.",
    criteria: [
      ["Creativity", 15],
      ["Use of material", 10],
      ["Finish", 5],
    ],
  },
  {
    key: "quick-sketch",
    title: "Quick Sketch: 10-Minute Challenge",
    brief: "One sketch, ten minutes, no erasing. Draw the view from your window.",
    criteria: [["Overall", 5]],
  },
];

const FILE_RULES = [
  {
    allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg"],
    maxFileSizeMb: 25,
    maxFiles: 5,
  },
  { allowedMimeTypes: ["image/png", "image/jpeg"], maxFileSizeMb: 10, maxFiles: 10 },
  { allowedMimeTypes: ["application/pdf"], maxFileSizeMb: 15, maxFiles: 1 },
] as const;

const FILE_NAMES_PDF = [
  "final-submission.pdf",
  "process-book.pdf",
  "case-study.pdf",
  "portfolio-spread.pdf",
  "rationale.pdf",
];
const FILE_NAMES_PNG = [
  "moodboard.png",
  "sketch-01.png",
  "sketch-02.png",
  "model-front.png",
  "palette.png",
  "detail-shot.png",
];

const SUBMISSION_NOTES = [
  "Tried a monochrome direction first and then added an accent colour.",
  "Process sketches are on the last pages.",
  "Photographed in daylight — some shadows on the left side, sorry!",
  "I wasn't sure about the rationale length, kept it to one paragraph.",
  "Revised version addressing the proportion feedback.",
  "Second attempt — reworked the layout and typography.",
  null,
  null,
];

const REVIEW_COMMENTS_GOOD = [
  "Strong concept and clean execution. Well done.",
  "Clear direction and good craft — the annotations really help.",
  "Excellent use of material; presentation is tidy and readable.",
  "Good work overall. Push the contrast a little further next time.",
];
const REVIEW_COMMENTS_REVISE = [
  "The idea is promising but proportions need work — please revisit the figure studies.",
  "Rationale is missing. Add a short paragraph explaining your choices and resubmit.",
  "Too close to the reference images. Develop your own direction further.",
  "Craft needs attention — edges and finishing are rough. Please rework.",
];
const RUBRIC_COMMENTS = [
  "Nice.",
  "Could be tighter.",
  "Good attention to detail.",
  "Needs more exploration.",
  null,
  null,
  null,
];
const SUBMISSION_THREAD = [
  "Could you clarify whether hand-drawn scans are acceptable?",
  "Yes, scans are fine as long as they are legible.",
  "Thanks for the feedback — I'll rework the second page.",
  "Please check the annotation on page 3, it explains the material choice.",
  "Noted. Looks much clearer now.",
];

const THREAD_DISCUSSIONS = [
  "How do you stay consistent with daily sketching?",
  "Share your favourite colour palettes this week",
  "Best resources for learning perspective drawing?",
  "Study group for NIFT 2027 — anyone in Pune?",
  "What does your portfolio review checklist look like?",
  "Introducing myself — aspiring interior designer from Kochi",
  "Tips for managing time during the situation test",
  "Which sketchbook paper weight do you prefer?",
  "Weekly critique thread: post your work in progress",
  "How are you preparing for the CEED studio test?",
  "Favourite design documentaries?",
  "Balancing coaching classes with school — advice?",
];
const THREAD_QUESTIONS = [
  "Why does my two-point perspective look distorted?",
  "What's the difference between twill and satin weave?",
  "How many heads tall should a fashion croquis be?",
  "Is 1:50 enough detail for an interior plan?",
  "How do I choose a colour scheme for a mood board?",
  "What counts as 'process work' in a portfolio?",
  "Can I submit PNGs instead of a PDF for the assignment?",
  "How is negative marking calculated on the mock exam?",
  "Struggling with drawing hands — any exercises?",
  "What should the rationale paragraph include?",
  "How do I photograph a physical model well?",
  "Which pencils are best for shading value scales?",
];
const THREAD_BODIES = [
  "I've been stuck on this for a few days and would love some pointers from people who've been through it.",
  "Sharing what has worked for me so far — curious what everyone else does.",
  "Attached a description of my approach below. Any feedback is welcome!",
  "Our mentor mentioned this in the last session but I didn't fully get it.",
  "Not sure if this is the right board for this, happy to move it.",
];
const REPLY_BODIES = [
  "Great question! What helped me was practising with a timer every day.",
  "I had the same problem — try drawing the horizon line first and keep it fixed.",
  "Check the lesson on colour theory, the second half explains this well.",
  "+1, following this thread.",
  "Short answer: yes. Long answer: it depends on the brief, read the file rules carefully.",
  "I'd recommend breaking it into smaller studies before attempting the full piece.",
  "Thanks, this helped a lot!",
  "Mentor here — the key is consistency over intensity. 20 minutes a day beats 3 hours once a week.",
  "Can you share a photo of what you have so far?",
  "Twill has a diagonal rib; satin has long floats that make it smooth and shiny.",
  "Use soft daylight from one side and a plain background — no flash.",
  "Negative marking deducts the stated fraction of the question's marks for each wrong answer; unanswered questions cost nothing.",
];
const LONG_BODY = "This is a deliberately long post to test how the forum renders lengthy content. "
  .repeat(40)
  .trim();

const HIDDEN_REASONS = [
  "Off-topic promotional content",
  "Contains personal contact details",
  "Shares answers to a graded assignment",
];
const REPORT_REASONS = [
  "Spam or self-promotion",
  "Inappropriate language",
  "Sharing answers to a graded assignment",
  "Duplicate thread",
];

const MENTOR_NOTES = [
  "Strong at ideation, needs to work on finishing and presentation.",
  "Missed the last two sessions — follow up with guardian if this continues.",
  "Very motivated; ready for harder mock exams.",
  "Struggles with time management in timed tests.",
  "Portfolio direction agreed: sustainable streetwear.",
];
const MENTOR_TASKS = [
  "Complete 3 perspective drawing exercises",
  "Finish the colour theory module",
  "Attempt the mock exam under timed conditions",
  "Revise portfolio spread based on feedback",
  "Read two case studies and summarise them",
  "Prepare questions for next mentoring session",
];
const MENTOR_FEEDBACK = [
  "Great progress this month — your sketches are much more confident.",
  "Focus on completing modules before attempting new quizzes.",
  "Your mock exam score improved by 15% — keep it up!",
  "Please submit pending assignments before the deadline.",
];
const MEETING_SUMMARIES = [
  "Reviewed mock exam results and set targets for next week.",
  "Discussed portfolio direction and shortlisted three projects.",
  "Went through situation test strategy.",
  "Check-in on progress; student felt confident about colour theory.",
  null,
];

// Tiny real files so CLEAN submission files are genuinely downloadable/viewable.
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
function pdfBytes(title: string): Buffer {
  const text = `Examora bulk test file: ${title}`.replace(/[()\\]/g, "");
  const stream = `BT /F1 14 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) body += `${String(off).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

// ---------------------------------------------------------------------------
// Shared state built up section by section
// ---------------------------------------------------------------------------

type RoleName = "STUDENT" | "MENTOR" | "REVIEWER" | "ADMINISTRATOR" | "GUARDIAN";

interface BulkUser {
  id: string;
  email: string;
  role: RoleName;
  index: number;
  status: "PENDING_VERIFICATION" | "ACTIVE" | "INACTIVE" | "SUSPENDED" | "ARCHIVED";
  createdAt: Date;
  /** 0..1 — drives quiz scores and rubric marks. */
  skill: number;
  /** 0..1 — drives how much a student actually does. */
  diligence: number;
}

interface CourseInfo {
  id: string;
  slug: string;
  title: string;
  price: number | null;
  lessonIds: string[];
  subjectIds: string[];
}

interface EnrollmentInfo {
  courseId: string;
  enrolledAt: Date;
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
}

interface DemoIds {
  adminId: string;
  mentorId: string;
  studentId: string;
}

interface Ctx {
  scale: Scale;
  demo: DemoIds;
  students: BulkUser[];
  mentors: BulkUser[];
  reviewers: BulkUser[];
  guardians: BulkUser[];
  admins: BulkUser[];
  reviewerLogin: BulkUser;
  guardianLogin: BulkUser;
  courses: CourseInfo[];
  courseBySubject: Map<string, string>;
  enrollments: Map<string, EnrollmentInfo[]>;
}

/** Students who can actually do things (log in and use the app). */
const isActiveUser = (u: BulkUser): boolean => u.status === "ACTIVE";

function accessibleEnrollment(
  ctx: Ctx,
  studentId: string,
  courseId: string,
): EnrollmentInfo | undefined {
  return ctx.enrollments
    .get(studentId)
    ?.find((e) => e.courseId === courseId && e.status !== "REVOKED");
}

// ---------------------------------------------------------------------------
// 1. Users, roles, profiles, consent
// ---------------------------------------------------------------------------

async function seedUsers(
  scale: Scale,
  demo: DemoIds,
): Promise<Omit<Ctx, "courses" | "courseBySubject" | "enrollments">> {
  const sizes = SCALES[scale];
  const password = process.env.DEV_SEED_PASSWORD || "a-strong-password-123";
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const roles = await prisma.role.findMany();
  const roleId = new Map(roles.map((r) => [r.name as RoleName, r.id]));

  const userRows: Prisma.UserCreateManyInput[] = [];
  const userRoleRows: Prisma.UserRoleCreateManyInput[] = [];
  const consentRows: Prisma.ConsentRecordCreateManyInput[] = [];

  function make(
    role: RoleName,
    index: number,
    email: string,
    opts: { forceActive?: boolean; guardianEmail?: string | null } = {},
  ): BulkUser {
    const label = `user:${email}`;
    const r = rng(label);
    let first: string | null = pick(r, FIRST_NAMES);
    let last: string | null = pick(r, LAST_NAMES);
    const edge = role === "STUDENT" ? EDGE_CASE_NAMES[index] : undefined;
    if (edge) [first, last] = edge;

    const status: BulkUser["status"] =
      opts.forceActive || role !== "STUDENT"
        ? "ACTIVE"
        : weighted(r, [
            ["ACTIVE", 85],
            ["PENDING_VERIFICATION", 6],
            ["INACTIVE", 4],
            ["SUSPENDED", 3],
            ["ARCHIVED", 2],
          ] as const);
    // Skewed towards recent sign-ups, so the user-growth chart actually grows.
    const createdAt =
      role === "STUDENT"
        ? daysAgo(Math.floor(180 * Math.pow(r(), 0.8)) + 1)
        : daysAgo(int(r, 150, 200));
    const id = bid(label);

    userRows.push({
      id,
      email,
      passwordHash,
      firstName: first,
      lastName: last,
      status,
      emailVerifiedAt:
        status === "PENDING_VERIFICATION" ? null : plus(createdAt, int(r, 1, 30) * MINUTE),
      phone: chance(r, 0.8) ? `+91 9${String(int(r, 100000000, 999999999))}` : null,
      dateOfBirth: role === "STUDENT" ? daysAgo(365 * int(r, 16, 24) + int(r, 0, 364)) : null,
      guardianEmail: opts.guardianEmail ?? null,
      guardianName: opts.guardianEmail
        ? `${pick(r, FIRST_NAMES)} ${last ?? pick(r, LAST_NAMES)}`
        : null,
      consentVersion: "2026-01",
      consentChannel: "web",
      consentedAt: createdAt,
      createdAt,
    });
    const rid = roleId.get(role);
    if (rid) userRoleRows.push({ userId: id, roleId: rid, assignedAt: createdAt });

    consentRows.push(
      {
        id: bid(`${label}:consent:tos`),
        userId: id,
        type: "TERMS_OF_SERVICE",
        version: "2026-01",
        channel: "web",
        granted: true,
        createdAt,
      },
      {
        id: bid(`${label}:consent:privacy`),
        userId: id,
        type: "PRIVACY_POLICY",
        version: "2026-01",
        channel: "web",
        granted: true,
        createdAt,
      },
    );
    if (chance(r, 0.6)) {
      const granted = chance(r, 0.7);
      consentRows.push({
        id: bid(`${label}:consent:marketing`),
        userId: id,
        type: "MARKETING",
        version: "2026-01",
        channel: "web",
        granted,
        createdAt,
      });
      // A later withdrawal, to exercise the append-only consent trail.
      if (granted && chance(r, 0.2)) {
        consentRows.push({
          id: bid(`${label}:consent:marketing-withdrawn`),
          userId: id,
          type: "MARKETING",
          version: "2026-01",
          channel: "profile",
          granted: false,
          createdAt: between(r, createdAt, at(NOW)),
        });
      }
    }
    if (opts.guardianEmail) {
      consentRows.push({
        id: bid(`${label}:consent:guardian`),
        userId: id,
        type: "GUARDIAN_COMMUNICATION",
        version: "2026-01",
        channel: "web",
        granted: true,
        createdAt,
      });
    }

    return {
      id,
      email,
      role,
      index,
      status,
      createdAt,
      skill: 0.35 + r() * 0.6,
      diligence: 0.25 + r() * 0.7,
    };
  }

  const pad = (n: number, w: number): string => String(n).padStart(w, "0");

  const admins = Array.from({ length: sizes.admins }, (_, i) =>
    make("ADMINISTRATOR", i, `admin${pad(i + 1, 2)}@${BULK_DOMAIN}`),
  );
  const reviewerLogin = make("REVIEWER", -1, REVIEWER_LOGIN);
  const guardianLogin = make("GUARDIAN", -1, GUARDIAN_LOGIN);
  const reviewers = Array.from({ length: sizes.reviewers }, (_, i) =>
    make("REVIEWER", i, `reviewer${pad(i + 1, 2)}@${BULK_DOMAIN}`),
  );
  const mentors = Array.from({ length: sizes.mentors }, (_, i) =>
    make("MENTOR", i, `mentor${pad(i + 1, 3)}@${BULK_DOMAIN}`),
  );
  const guardians = Array.from({ length: sizes.guardians }, (_, i) =>
    make("GUARDIAN", i, `guardian${pad(i + 1, 3)}@${BULK_DOMAIN}`),
  );

  const students = Array.from({ length: sizes.students }, (_, i) => {
    const email = `student${pad(i + 1, 4)}@${BULK_DOMAIN}`;
    const r = rng(`guardian-link:${email}`);
    // The first two students belong to the guardian@examora.test login.
    const guardianEmail =
      i < 2
        ? GUARDIAN_LOGIN
        : chance(r, 0.45) && guardians.length > 0
          ? guardians[i % guardians.length]!.email
          : null;
    return make("STUDENT", i, email, { forceActive: i < 5, guardianEmail });
  });

  const mentorProfiles: Prisma.MentorProfileCreateManyInput[] = mentors.map((m, i) => {
    const r = rng(`mentor-profile:${m.email}`);
    return {
      id: bid(`mentor-profile:${m.email}`),
      userId: m.id,
      bio: `${pick(r, SPECIALIZATIONS)} mentor with ${int(r, 2, 15)} years of teaching experience.`,
      specialization: pick(r, SPECIALIZATIONS),
      // mentor001 deliberately has a tiny capacity — it gets over-assigned below.
      maxStudents: i === 0 ? 5 : int(r, 8, 25),
    };
  });

  await insert("users", userRows, (data) => prisma.user.createMany({ data, skipDuplicates: true }));
  await insert("user roles", userRoleRows, (data) =>
    prisma.userRole.createMany({ data, skipDuplicates: true }),
  );
  await insert("consent records", consentRows, (data) =>
    prisma.consentRecord.createMany({ data, skipDuplicates: true }),
  );
  await insert("mentor profiles", mentorProfiles, (data) =>
    prisma.mentorProfile.createMany({ data, skipDuplicates: true }),
  );

  return {
    scale,
    demo,
    students,
    mentors,
    reviewers,
    guardians,
    admins,
    reviewerLogin,
    guardianLogin,
  };
}

// ---------------------------------------------------------------------------
// 2. Catalog: a couple of edge-case courses, then load the published catalog
// ---------------------------------------------------------------------------

async function seedEdgeCaseCourses(adminId: string): Promise<void> {
  const category = await prisma.category.findFirst({
    where: { deletedAt: null, isActive: true },
    orderBy: { position: "asc" },
  });
  await insert<Prisma.CourseCreateManyInput>(
    "courses",
    [
      {
        id: bid("course:empty"),
        categoryId: category?.id ?? null,
        title:
          "Sustainable Fashion Lab (Coming Soon) — a published course that has no curriculum yet",
        slug: "bulk-sustainable-fashion-lab",
        description:
          "Edge case: published with zero subjects/lessons. Progress should show 0 of 0 without errors.",
        examType: "NIFT",
        status: "PUBLISHED",
        publishedAt: daysAgo(20),
        position: 900,
        createdById: adminId,
      },
      {
        id: bid("course:archived"),
        categoryId: category?.id ?? null,
        title: "Legacy: CEED 2024 Crash Course",
        slug: "bulk-legacy-ceed-2024",
        description:
          "Edge case: an archived paid course that should not appear in the student catalog.",
        examType: "CEED",
        status: "ARCHIVED",
        publishedAt: daysAgo(400),
        position: 901,
        priceAmount: 2999,
        createdById: adminId,
      },
    ],
    (data) => prisma.course.createMany({ data, skipDuplicates: true }),
  );
}

async function loadCatalog(): Promise<{
  courses: CourseInfo[];
  courseBySubject: Map<string, string>;
}> {
  const published = { status: "PUBLISHED" as const, deletedAt: null };
  const rows = await prisma.course.findMany({
    where: published,
    orderBy: { slug: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      priceAmount: true,
      subjects: {
        where: published,
        orderBy: { position: "asc" },
        select: {
          id: true,
          topics: {
            where: published,
            orderBy: { position: "asc" },
            select: {
              modules: {
                where: published,
                orderBy: { position: "asc" },
                select: {
                  lessons: { where: published, orderBy: { position: "asc" }, select: { id: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  const courseBySubject = new Map<string, string>();
  const courses = rows.map((c) => {
    for (const s of c.subjects) courseBySubject.set(s.id, c.id);
    return {
      id: c.id,
      slug: c.slug,
      title: c.title,
      price: c.priceAmount === null ? null : Number(c.priceAmount),
      subjectIds: c.subjects.map((s) => s.id),
      lessonIds: c.subjects.flatMap((s) =>
        s.topics.flatMap((t) => t.modules.flatMap((m) => m.lessons.map((l) => l.id))),
      ),
    };
  });
  return { courses, courseBySubject };
}

// ---------------------------------------------------------------------------
// 3. Commerce + enrollments (coupons, orders, payments, invoices, refunds)
// ---------------------------------------------------------------------------

async function seedCommerce(ctx: Ctx): Promise<void> {
  const creator = ctx.admins[0]!.id;
  const coupons = [
    {
      code: "BULK10",
      discountType: "PERCENTAGE",
      discountValue: 10,
      maxRedemptions: null,
      validFrom: daysAgo(180),
      validUntil: daysAhead(60),
      isActive: true,
    },
    {
      code: "BULK25",
      discountType: "PERCENTAGE",
      discountValue: 25,
      maxRedemptions: 500,
      validFrom: daysAgo(120),
      validUntil: daysAhead(30),
      isActive: true,
    },
    {
      code: "BULK500OFF",
      discountType: "FIXED",
      discountValue: 500,
      maxRedemptions: null,
      validFrom: null,
      validUntil: null,
      isActive: true,
    },
    {
      code: "BULKEXPIRED",
      discountType: "PERCENTAGE",
      discountValue: 30,
      maxRedemptions: null,
      validFrom: daysAgo(200),
      validUntil: daysAgo(90),
      isActive: true,
    },
    {
      code: "BULKMAXED",
      discountType: "FIXED",
      discountValue: 1000,
      maxRedemptions: 3,
      validFrom: daysAgo(180),
      validUntil: daysAhead(90),
      isActive: true,
    },
    {
      code: "BULKINACTIVE",
      discountType: "PERCENTAGE",
      discountValue: 50,
      maxRedemptions: null,
      validFrom: null,
      validUntil: null,
      isActive: false,
    },
    {
      code: "BULKFUTURE",
      discountType: "PERCENTAGE",
      discountValue: 15,
      maxRedemptions: 100,
      validFrom: daysAhead(10),
      validUntil: daysAhead(40),
      isActive: true,
    },
  ] as const;
  const couponId = (code: string): string => bid(`coupon:${code}`);
  const usableCoupons = ["BULK10", "BULK25", "BULK500OFF", "BULKMAXED"] as const;
  const redemptions = new Map<string, number>();

  const orders: Prisma.OrderCreateManyInput[] = [];
  const payments: Prisma.PaymentCreateManyInput[] = [];
  const invoices: Prisma.InvoiceCreateManyInput[] = [];
  const refunds: Prisma.RefundCreateManyInput[] = [];
  const enrollments: Prisma.EnrollmentCreateManyInput[] = [];

  const enrollable = ctx.courses;

  for (const student of ctx.students) {
    const r = rng(`commerce:${student.email}`);
    const list: EnrollmentInfo[] = [];
    ctx.enrollments.set(student.id, list);
    if (student.status === "PENDING_VERIFICATION") continue;

    const chosen = sample(
      r,
      enrollable,
      weighted(r, [
        [1, 25],
        [2, 30],
        [3, 25],
        [4, 12],
        [5, 8],
      ] as const),
    );
    const owned = new Set(chosen.map((c) => c.id));

    const makeOrder = (
      course: CourseInfo,
      status: Prisma.OrderCreateManyInput["status"],
      createdAt: Date,
      tag: string,
    ) => {
      const price = course.price ?? 0;
      let discount = 0;
      let coupon: string | null = null;
      if (chance(r, 0.2)) {
        const code = pick(r, usableCoupons);
        const def = coupons.find((c) => c.code === code)!;
        const used = redemptions.get(code) ?? 0;
        if (def.maxRedemptions === null || used < def.maxRedemptions) {
          coupon = code;
          discount =
            def.discountType === "PERCENTAGE"
              ? Math.round((price * def.discountValue) / 100)
              : Math.min(def.discountValue, price);
        }
      }
      const id = bid(`order:${student.email}:${course.id}:${tag}`);
      const counted = status === "PAID" || status === "REFUNDED" || status === "PARTIALLY_REFUNDED";
      if (coupon && counted) redemptions.set(coupon, (redemptions.get(coupon) ?? 0) + 1);
      orders.push({
        id,
        userId: student.id,
        courseId: course.id,
        couponId: coupon ? couponId(coupon) : null,
        status,
        subtotalAmount: price,
        discountAmount: discount,
        totalAmount: price - discount,
        createdAt,
      });
      return { id, total: price - discount };
    };

    const payment = (
      orderId: string,
      amount: number,
      status: Prisma.PaymentCreateManyInput["status"],
      createdAt: Date,
    ): void => {
      const h = hex(`payment:${orderId}`);
      payments.push({
        id: bid(`payment:${orderId}`),
        orderId,
        gatewayOrderId: `bulk_order_${h.slice(0, 14)}`,
        gatewayPaymentId: status === "CREATED" ? null : `bulk_pay_${h.slice(14, 28)}`,
        status,
        amount,
        verifiedAt:
          status === "CAPTURED" || status === "REFUNDED" ? plus(createdAt, 2 * MINUTE) : null,
        createdAt,
      });
    };

    for (const course of chosen) {
      const enrolledAt = between(r, plus(student.createdAt, HOUR), at(NOW - HOUR));
      const enrollmentId = bid(`enrollment:${student.email}:${course.id}`);

      if (course.price === null) {
        const status = chance(r, 0.03) ? "REVOKED" : "ACTIVE";
        enrollments.push({
          id: enrollmentId,
          userId: student.id,
          courseId: course.id,
          status,
          source: "FREE",
          enrolledAt,
          revokedAt: status === "REVOKED" ? between(r, enrolledAt, at(NOW)) : null,
          createdAt: enrolledAt,
        });
        list.push({ courseId: course.id, enrolledAt, status });
        continue;
      }

      const outcome = weighted(r, [
        ["PAID", 70],
        ["ADMIN_GRANT", 7],
        ["REFUNDED", 5],
        ["PARTIAL", 2],
        ["REFUND_PENDING", 4],
        ["REFUND_DENIED", 2],
        ["EXPIRED", 6],
        ["STALE_ACTIVE", 1],
        ["RETRY_AFTER_FAIL", 3],
      ] as const);

      if (outcome === "ADMIN_GRANT") {
        enrollments.push({
          id: enrollmentId,
          userId: student.id,
          courseId: course.id,
          status: "ACTIVE",
          source: "ADMIN_GRANT",
          enrolledAt,
          createdAt: enrolledAt,
        });
        list.push({ courseId: course.id, enrolledAt, status: "ACTIVE" });
        continue;
      }

      if (outcome === "RETRY_AFTER_FAIL") {
        const failedAt = plus(enrolledAt, -int(r, 10, 120) * MINUTE);
        const failed = makeOrder(course, "FAILED", failedAt, "failed");
        payment(failed.id, failed.total, "FAILED", failedAt);
      }

      const orderStatus =
        outcome === "REFUNDED" ? "REFUNDED" : outcome === "PARTIAL" ? "PARTIALLY_REFUNDED" : "PAID";
      const orderAt = plus(enrolledAt, -3 * MINUTE);
      const order = makeOrder(course, orderStatus, orderAt, "paid");
      payment(order.id, order.total, outcome === "REFUNDED" ? "REFUNDED" : "CAPTURED", orderAt);
      invoices.push({
        id: bid(`invoice:${order.id}`),
        orderId: order.id,
        invoiceNumber: `BULK-INV-${hex(`invoice-number:${order.id}`).slice(0, 10).toUpperCase()}`,
        amount: order.total,
        issuedAt: plus(orderAt, 2 * MINUTE),
      });

      let status: EnrollmentInfo["status"] = "ACTIVE";
      let expiresAt: Date | null = chance(r, 0.3) ? plus(enrolledAt, 365 * DAY) : null;
      let revokedAt: Date | null = null;

      if (outcome === "EXPIRED") {
        status = "EXPIRED";
        expiresAt = notFuture(plus(enrolledAt, int(r, 20, 90) * DAY));
      } else if (outcome === "STALE_ACTIVE") {
        // Inconsistent on purpose: ACTIVE row whose expiresAt has passed. The
        // access gate must still refuse it.
        expiresAt = between(r, enrolledAt, at(NOW - HOUR));
      } else if (outcome === "REFUNDED" || outcome === "PARTIAL") {
        const requestedAt = between(r, enrolledAt, at(NOW));
        const reviewedAt = notFuture(plus(requestedAt, int(r, 1, 72) * HOUR));
        status = "REVOKED";
        revokedAt = reviewedAt;
        refunds.push({
          id: bid(`refund:${order.id}`),
          orderId: order.id,
          requestedById: student.id,
          reviewedById: pick(r, ctx.admins).id,
          status: "PROCESSED",
          amount: outcome === "PARTIAL" ? Math.round(order.total / 2) : order.total,
          reason: pick(r, [
            "Course was not what I expected",
            "Bought the wrong course by mistake",
            "Unable to continue due to exams",
            "Duplicate purchase",
          ]),
          requestedAt,
          reviewedAt,
        });
      } else if (outcome === "REFUND_PENDING" || outcome === "REFUND_DENIED") {
        const requestedAt = between(r, enrolledAt, at(NOW));
        refunds.push({
          id: bid(`refund:${order.id}`),
          orderId: order.id,
          requestedById: student.id,
          reviewedById: outcome === "REFUND_DENIED" ? pick(r, ctx.admins).id : null,
          status: outcome === "REFUND_DENIED" ? "DENIED" : "REQUESTED",
          amount: order.total,
          reason: pick(r, [
            "Content too advanced for me",
            "Found a cheaper alternative",
            "Technical issues playing videos",
          ]),
          requestedAt,
          reviewedAt:
            outcome === "REFUND_DENIED" ? notFuture(plus(requestedAt, int(r, 1, 48) * HOUR)) : null,
        });
      }

      enrollments.push({
        id: enrollmentId,
        userId: student.id,
        courseId: course.id,
        orderId: order.id,
        status,
        source: "PURCHASE",
        enrolledAt,
        expiresAt,
        revokedAt,
        createdAt: enrolledAt,
      });
      list.push({ courseId: course.id, enrolledAt, status });
    }

    // Purchase attempts that never became an enrollment: abandoned, failed, cancelled.
    const notOwned = enrollable.filter((c) => c.price !== null && !owned.has(c.id));
    if (notOwned.length > 0) {
      for (const [status, p] of [
        ["PENDING", 0.08],
        ["FAILED", 0.1],
        ["CANCELLED", 0.05],
      ] as const) {
        if (!chance(r, p)) continue;
        const course = pick(r, notOwned);
        const createdAt = between(r, student.createdAt, at(NOW));
        const order = makeOrder(course, status, createdAt, status.toLowerCase());
        payment(
          order.id,
          order.total,
          status === "PENDING" ? "CREATED" : status === "FAILED" ? "FAILED" : "CREATED",
          createdAt,
        );
      }
    }
  }

  await insert(
    "coupons",
    coupons.map((c) => ({
      id: couponId(c.code),
      code: c.code,
      discountType: c.discountType,
      discountValue: c.discountValue,
      maxRedemptions: c.maxRedemptions,
      redemptionCount:
        c.code === "BULKMAXED"
          ? Math.max(3, redemptions.get(c.code) ?? 0)
          : (redemptions.get(c.code) ?? 0),
      validFrom: c.validFrom,
      validUntil: c.validUntil,
      isActive: c.isActive,
      createdById: creator,
    })),
    (data) => prisma.coupon.createMany({ data, skipDuplicates: true }),
  );
  await insert("orders", orders, (data) => prisma.order.createMany({ data, skipDuplicates: true }));
  await insert("payments", payments, (data) =>
    prisma.payment.createMany({ data, skipDuplicates: true }),
  );
  await insert("invoices", invoices, (data) =>
    prisma.invoice.createMany({ data, skipDuplicates: true }),
  );
  await insert("refunds", refunds, (data) =>
    prisma.refund.createMany({ data, skipDuplicates: true }),
  );
  await insert("enrollments", enrollments, (data) =>
    prisma.enrollment.createMany({ data, skipDuplicates: true }),
  );
}

// ---------------------------------------------------------------------------
// 4. Lesson progress
// ---------------------------------------------------------------------------

async function seedLessonProgress(ctx: Ctx): Promise<void> {
  const rows: Prisma.LessonProgressCreateManyInput[] = [];
  const lessonsByCourse = new Map(ctx.courses.map((c) => [c.id, c.lessonIds]));

  for (const student of ctx.students) {
    for (const enr of ctx.enrollments.get(student.id) ?? []) {
      const lessons = lessonsByCourse.get(enr.courseId) ?? [];
      if (lessons.length === 0) continue;
      const r = rng(`progress:${student.email}:${enr.courseId}`);
      const engagement = weighted(r, [
        ["none", 12],
        ["light", 25],
        ["mid", 30],
        ["complete", 33 * student.diligence],
      ] as const);
      const viewed =
        engagement === "none"
          ? 0
          : engagement === "light"
            ? Math.max(1, Math.round(lessons.length * (0.1 + r() * 0.25)))
            : engagement === "mid"
              ? Math.max(1, Math.round(lessons.length * (0.35 + r() * 0.45)))
              : lessons.length;
      if (viewed === 0) continue;

      // Some students stop early; their last activity is weeks ago ("at risk").
      const stoppedEarly = engagement !== "complete" && chance(r, 0.3);
      const windowEnd = stoppedEarly ? between(r, enr.enrolledAt, daysAgo(14)) : at(NOW - HOUR);
      const step = Math.max(
        10 * MINUTE,
        (windowEnd.getTime() - enr.enrolledAt.getTime()) / (viewed + 1),
      );
      let t = plus(enr.enrolledAt, int(r, 5, 60) * MINUTE);

      for (let i = 0; i < viewed; i++) {
        const lessonId = lessons[i]!;
        const firstViewedAt = notFuture(t);
        const lastViewedAt = notFuture(plus(firstViewedAt, int(r, 5, 50) * MINUTE));
        const completed = engagement === "complete" || i < viewed - 1 || chance(r, 0.5);
        rows.push({
          id: bid(`progress:${student.email}:${lessonId}`),
          userId: student.id,
          lessonId,
          courseId: enr.courseId,
          firstViewedAt,
          lastViewedAt,
          completedAt: completed ? lastViewedAt : null,
          createdAt: firstViewedAt,
        });
        t = plus(t, step * (0.4 + r() * 1.2));
      }
    }
  }
  await insert("lesson progress", rows, (data) =>
    prisma.lessonProgress.createMany({ data, skipDuplicates: true }),
  );
}

// ---------------------------------------------------------------------------
// 5. Question bank, quizzes and attempts
// ---------------------------------------------------------------------------

async function seedQuizContent(ctx: Ctx): Promise<void> {
  const questions: Prisma.QuestionCreateManyInput[] = [];
  const options: Prisma.QuestionOptionCreateManyInput[] = [];
  const quizzes: Prisma.QuizCreateManyInput[] = [];
  const sections: Prisma.QuizSectionCreateManyInput[] = [];
  const quizQuestions: Prisma.QuizQuestionCreateManyInput[] = [];
  const author = ctx.admins[0]!.id;
  const subjectIds = ctx.courses.flatMap((c) => c.subjectIds);
  const marksFor = { EASY: 1, MEDIUM: 2, HARD: 3 } as const;

  for (const [si, subjectId] of subjectIds.entries()) {
    const subject = await prisma.subject.findUniqueOrThrow({
      where: { id: subjectId },
      select: { title: true },
    });
    const r = rng(`quiz-bank:${subjectId}`);
    const picked = sample(
      r,
      QUESTION_POOL.map((q, i) => [q, i] as const),
      13,
    );

    const bank = picked
      .map(([q, poolIdx], pos) => {
        const id = bid(`question:${subjectId}:${poolIdx}`);
        questions.push({
          id,
          subjectId,
          type: q.type,
          difficulty: q.difficulty,
          text: q.text,
          explanation: q.explanation,
          tags: ["bulk-seed", q.difficulty.toLowerCase()],
          // The 13th question stays DRAFT — a bank question not yet usable in quizzes.
          status: pos === 12 ? "DRAFT" : "PUBLISHED",
          position: pos,
          createdById: author,
        });
        q.options.forEach(([text, isCorrect], oi) => {
          options.push({
            id: bid(`option:${subjectId}:${poolIdx}:${oi}`),
            questionId: id,
            text,
            isCorrect,
            position: oi,
          });
        });
        return { id, marks: marksFor[q.difficulty] };
      })
      .slice(0, 12);

    const publishedAt = daysAgo(int(r, 100, 170));
    const practiceId = bid(`quiz:practice:${subjectId}`);
    quizzes.push({
      id: practiceId,
      subjectId,
      title: `Practice Test: ${subject.title}`,
      slug: `bulk-practice-${subjectId.slice(0, 8)}`,
      description: "Ten quick questions to check your understanding. Retake as often as you like.",
      status: "PUBLISHED",
      timeLimitMinutes: si % 2 === 0 ? 15 : null,
      passingScorePercent: 40,
      shuffleOptions: true,
      position: 100,
      publishedAt,
      createdById: author,
    });
    bank.slice(0, 10).forEach((q, pos) => {
      quizQuestions.push({
        id: bid(`quiz-question:${practiceId}:${q.id}`),
        quizId: practiceId,
        questionId: q.id,
        marks: q.marks,
        position: pos,
      });
    });

    if (si % 3 === 0) {
      const mockId = bid(`quiz:mock:${subjectId}`);
      quizzes.push({
        id: mockId,
        subjectId,
        title: `Mock Exam: ${subject.title}`,
        slug: `bulk-mock-${subjectId.slice(0, 8)}`,
        description: "Timed, two-section mock exam with negative marking (0.25 per wrong answer).",
        status: "PUBLISHED",
        timeLimitMinutes: 30,
        passingScorePercent: 50,
        negativeMarkingEnabled: true,
        negativeMarksPerWrong: 0.25,
        shuffleQuestions: true,
        shuffleOptions: true,
        position: 101,
        publishedAt,
        createdById: author,
      });
      const secA = bid(`quiz-section:${mockId}:a`);
      const secB = bid(`quiz-section:${mockId}:b`);
      sections.push(
        { id: secA, quizId: mockId, title: "Section A: Fundamentals", position: 0 },
        {
          id: secB,
          quizId: mockId,
          title: "Section B: Applied",
          description: "Harder, application-based questions.",
          position: 1,
        },
      );
      bank.forEach((q, pos) => {
        quizQuestions.push({
          id: bid(`quiz-question:${mockId}:${q.id}`),
          quizId: mockId,
          questionId: q.id,
          sectionId: pos < 6 ? secA : secB,
          marks: q.marks,
          position: pos,
        });
      });
    }

    if (si === 0 || si === 1) {
      // One DRAFT quiz (admin-only) and one ARCHIVED quiz that still has historical attempts.
      const status = si === 0 ? "DRAFT" : "ARCHIVED";
      const id = bid(`quiz:${status}:${subjectId}`);
      quizzes.push({
        id,
        subjectId,
        title:
          si === 0
            ? `Draft: Final Assessment — ${subject.title}`
            : `Archived: 2025 Diagnostic — ${subject.title}`,
        slug: `bulk-${status.toLowerCase()}-${subjectId.slice(0, 8)}`,
        status,
        timeLimitMinutes: 20,
        passingScorePercent: 40,
        publishedAt: status === "ARCHIVED" ? daysAgo(175) : null,
        position: 102,
        createdById: author,
      });
      bank.slice(2, 8).forEach((q, pos) => {
        quizQuestions.push({
          id: bid(`quiz-question:${id}:${q.id}`),
          quizId: id,
          questionId: q.id,
          marks: q.marks,
          position: pos,
        });
      });
    }
  }

  await insert("questions", questions, (data) =>
    prisma.question.createMany({ data, skipDuplicates: true }),
  );
  await insert("question options", options, (data) =>
    prisma.questionOption.createMany({ data, skipDuplicates: true }),
  );
  await insert("quizzes", quizzes, (data) =>
    prisma.quiz.createMany({ data, skipDuplicates: true }),
  );
  await insert("quiz sections", sections, (data) =>
    prisma.quizSection.createMany({ data, skipDuplicates: true }),
  );
  await insert("quiz questions", quizQuestions, (data) =>
    prisma.quizQuestion.createMany({ data, skipDuplicates: true }),
  );
}

async function seedQuizAttempts(ctx: Ctx): Promise<void> {
  const quizzes = await prisma.quiz.findMany({
    where: { status: { in: ["PUBLISHED", "ARCHIVED"] }, deletedAt: null },
    include: {
      quizQuestions: {
        orderBy: { position: "asc" },
        include: { question: { include: { options: { orderBy: { position: "asc" } } } } },
      },
    },
  });

  const attempts: Prisma.QuizAttemptCreateManyInput[] = [];
  const answers: Prisma.QuizAttemptAnswerCreateManyInput[] = [];

  for (const quiz of quizzes) {
    if (quiz.quizQuestions.length === 0) continue;
    const courseId = quiz.subjectId ? ctx.courseBySubject.get(quiz.subjectId) : undefined;
    const archived = quiz.status === "ARCHIVED";
    const negPerWrong = quiz.negativeMarkingEnabled ? Number(quiz.negativeMarksPerWrong) : 0;
    const totalMarks = quiz.quizQuestions.reduce((sum, qq) => sum + Number(qq.marks), 0);

    for (const student of ctx.students) {
      if (!isActiveUser(student) && student.status !== "INACTIVE") continue;
      const enr = courseId ? accessibleEnrollment(ctx, student.id, courseId) : undefined;
      if (courseId && !enr) continue;
      const r = rng(`attempts:${student.email}:${quiz.id}`);
      if (!chance(r, 0.25 + student.diligence * 0.5)) continue;

      const count = weighted(r, [
        [1, 60],
        [2, 28],
        [3, 12],
      ] as const);
      const windowStart = later(
        enr?.enrolledAt ?? student.createdAt,
        quiz.publishedAt ?? student.createdAt,
      );
      const windowEnd = archived ? daysAgo(100) : at(NOW - 10 * MINUTE);
      if (windowEnd.getTime() <= windowStart.getTime()) continue;
      const starts = Array.from({ length: count }, () => between(r, windowStart, windowEnd)).sort(
        (a, b) => a.getTime() - b.getTime(),
      );

      starts.forEach((startedAt, n) => {
        const attemptId = bid(`attempt:${student.email}:${quiz.id}:${n}`);
        const isLast = n === count - 1;
        const skill = clamp(student.skill + n * 0.07, 0, 0.98);
        const limitMs = quiz.timeLimitMinutes ? quiz.timeLimitMinutes * MINUTE : null;

        let status: "SUBMITTED" | "AUTO_SUBMITTED" | "IN_PROGRESS" =
          limitMs && chance(r, 0.08) ? "AUTO_SUBMITTED" : "SUBMITTED";
        let start = startedAt;
        if (isLast && !archived && chance(r, 0.03)) {
          // A live attempt: started a few minutes ago, still open.
          status = "IN_PROGRESS";
          start = at(NOW - int(r, 1, 5) * MINUTE);
        }
        const expiresAt = limitMs ? plus(start, limitMs) : null;

        const ordered = quiz.shuffleQuestions ? shuffle(r, quiz.quizQuestions) : quiz.quizQuestions;
        const questionSnapshot = ordered.map((qq, position) => ({
          questionId: qq.questionId,
          sectionId: qq.sectionId,
          marks: Number(qq.marks),
          position,
        }));
        const optionOrder = Object.fromEntries(
          ordered.map((qq) => {
            const ids = qq.question.options.map((o) => o.id);
            return [qq.questionId, quiz.shuffleOptions ? shuffle(r, ids) : ids];
          }),
        );

        let obtained = 0;
        let correctCount = 0;
        let wrongCount = 0;
        let unansweredCount = 0;
        const duration = limitMs
          ? Math.min(limitMs, int(r, 3, 40) * MINUTE)
          : int(r, 3, 40) * MINUTE;
        const submittedAt =
          status === "AUTO_SUBMITTED"
            ? expiresAt!
            : status === "IN_PROGRESS"
              ? null
              : notFuture(plus(start, duration));

        ordered.forEach((qq, qi) => {
          const q = qq.question;
          const marks = Number(qq.marks);
          const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
          const wrongIds = q.options.filter((o) => !o.isCorrect).map((o) => o.id);
          const ranOut = status === "AUTO_SUBMITTED" && qi >= ordered.length * 0.7;
          const notYet = status === "IN_PROGRESS" && qi >= ordered.length * 0.4;
          if (notYet) return; // in-progress attempts only have rows for what was answered so far

          let selected: string[] = [];
          if (!ranOut && !chance(r, 0.05)) {
            const pCorrect = clamp(
              skill + (q.difficulty === "EASY" ? 0.15 : q.difficulty === "HARD" ? -0.15 : 0),
              0.05,
              0.97,
            );
            if (chance(r, pCorrect)) selected = correctIds;
            else if (q.type === "MULTIPLE_CHOICE" && correctIds.length > 1 && chance(r, 0.6))
              selected = correctIds.slice(0, -1);
            else if (q.type === "MULTIPLE_CHOICE") selected = [...correctIds, pick(r, wrongIds)];
            else selected = [pick(r, wrongIds)];
          }

          const answered = selected.length > 0;
          const isCorrect = answered
            ? selected.length === correctIds.length &&
              selected.every((id) => correctIds.includes(id))
            : null;
          const marksAwarded = !answered ? 0 : isCorrect ? marks : -(marks * negPerWrong);
          if (!answered) unansweredCount++;
          else if (isCorrect) correctCount++;
          else wrongCount++;
          obtained += marksAwarded;

          const answeredAt = answered
            ? notFuture(plus(start, Math.min(duration, ((qi + 1) / ordered.length) * duration)))
            : null;
          answers.push({
            id: bid(`answer:${attemptId}:${q.id}`),
            attemptId,
            questionId: q.id,
            selectedOptionIds: selected,
            isCorrect: status === "IN_PROGRESS" ? null : isCorrect,
            marksAwarded: status === "IN_PROGRESS" ? null : marksAwarded,
            answeredAt,
            createdAt: start,
          });
        });

        const obtainedMarks = round2(obtained);
        const percentage = totalMarks > 0 ? round2((obtainedMarks / totalMarks) * 100) : 0;
        const finished = status !== "IN_PROGRESS";
        attempts.push({
          id: attemptId,
          quizId: quiz.id,
          userId: student.id,
          status,
          questionSnapshot,
          optionOrder,
          passingScorePercent: quiz.passingScorePercent,
          negativeMarkingEnabled: quiz.negativeMarkingEnabled,
          negativeMarksPerWrong: quiz.negativeMarksPerWrong,
          totalMarks,
          startedAt: start,
          expiresAt,
          submittedAt,
          obtainedMarks: finished ? obtainedMarks : null,
          percentage: finished ? percentage : null,
          passed: finished ? percentage >= Number(quiz.passingScorePercent) : null,
          correctCount: finished ? correctCount : null,
          wrongCount: finished ? wrongCount : null,
          unansweredCount: finished
            ? unansweredCount + (ordered.length - correctCount - wrongCount - unansweredCount)
            : null,
          createdAt: start,
        });
      });
    }
  }

  await insert("quiz attempts", attempts, (data) =>
    prisma.quizAttempt.createMany({ data, skipDuplicates: true }),
  );
  await insert("quiz attempt answers", answers, (data) =>
    prisma.quizAttemptAnswer.createMany({ data, skipDuplicates: true }),
  );
}

// ---------------------------------------------------------------------------
// 6. Assignments: templates, assignments + rubrics, submissions through every
//    workflow state, reviews, rubric scores, comments, files
// ---------------------------------------------------------------------------

async function seedAssignmentContent(ctx: Ctx): Promise<void> {
  const author = ctx.admins[0]!.id;
  const templates: Prisma.AssignmentTemplateCreateManyInput[] = ASSIGNMENT_SPECS.slice(0, 6).map(
    (spec, i) => ({
      id: bid(`template:${spec.key}`),
      title: spec.title,
      brief: spec.brief,
      fileRules: {
        ...FILE_RULES[i % FILE_RULES.length]!,
        allowedMimeTypes: [...FILE_RULES[i % FILE_RULES.length]!.allowedMimeTypes],
      },
      marksTotal: spec.criteria.reduce((sum, [, m]) => sum + m, 0),
      rubric: spec.criteria.map(([title, maxMarks]) => ({ title, maxMarks })),
      createdById: author,
      createdAt: daysAgo(190),
    }),
  );

  const assignments: Prisma.AssignmentCreateManyInput[] = [];
  const criteria: Prisma.RubricCriterionCreateManyInput[] = [];
  const subjectIds = ctx.courses.flatMap((c) => c.subjectIds);

  const addAssignment = (
    key: string,
    subjectId: string | null,
    spec: AssignmentSpec,
    opts: {
      title: string;
      status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
      deadline: Date | null;
      publishedAt: Date | null;
      brief?: string;
      rules: (typeof FILE_RULES)[number];
    },
  ): void => {
    const id = bid(`assignment:${key}`);
    assignments.push({
      id,
      subjectId,
      title: opts.title,
      slug: `bulk-${key}`,
      brief: opts.brief ?? spec.brief,
      fileRules: { ...opts.rules, allowedMimeTypes: [...opts.rules.allowedMimeTypes] },
      marksTotal: spec.criteria.reduce((sum, [, m]) => sum + m, 0),
      deadline: opts.deadline,
      status: opts.status,
      publishedAt: opts.publishedAt,
      position: 100,
      createdById: author,
      createdAt: opts.publishedAt ? plus(opts.publishedAt, -2 * DAY) : daysAgo(5),
    });
    spec.criteria.forEach(([title, maxMarks], position) => {
      criteria.push({
        id: bid(`criterion:${key}:${position}`),
        assignmentId: id,
        title,
        description: `Marks awarded for ${title.toLowerCase()}.`,
        maxMarks,
        position,
      });
    });
  };

  for (const [si, subjectId] of subjectIds.entries()) {
    const subject = await prisma.subject.findUniqueOrThrow({
      where: { id: subjectId },
      select: { title: true },
    });
    const r = rng(`assignments:${subjectId}`);
    for (const spec of sample(r, ASSIGNMENT_SPECS, 2)) {
      const kind = weighted(r, [
        ["closed", 40],
        ["upcoming", 35],
        ["soon", 8],
        ["none", 17],
      ] as const);
      const deadline =
        kind === "closed"
          ? daysAgo(int(r, 3, 60))
          : kind === "upcoming"
            ? daysAhead(int(r, 3, 30))
            : kind === "soon"
              ? plus(at(NOW), int(r, 6, 36) * HOUR)
              : null;
      const publishedAt =
        deadline && kind === "closed"
          ? plus(deadline, -int(r, 14, 60) * DAY)
          : daysAgo(int(r, 20, 120));
      addAssignment(`${spec.key}-${subjectId.slice(0, 8)}`, subjectId, spec, {
        title: `${spec.title} — ${subject.title}`,
        status: "PUBLISHED",
        deadline,
        publishedAt,
        rules: pick(r, FILE_RULES),
      });
    }

    if (si === 0) {
      addAssignment(
        `draft-final-collection-${subjectId.slice(0, 8)}`,
        subjectId,
        ASSIGNMENT_SPECS[2]!,
        {
          title: "Draft: Final Collection Brief (not yet published)",
          status: "DRAFT",
          deadline: daysAhead(45),
          publishedAt: null,
          rules: FILE_RULES[0],
        },
      );
      addAssignment(
        `archived-summer-studio-${subjectId.slice(0, 8)}`,
        subjectId,
        ASSIGNMENT_SPECS[6]!,
        {
          title: "Archived: 2025 Summer Studio Project",
          status: "ARCHIVED",
          deadline: daysAgo(150),
          publishedAt: daysAgo(175),
          rules: FILE_RULES[0],
        },
      );
    }
    if (si === 1) {
      addAssignment(`long-brief-${subjectId.slice(0, 8)}`, subjectId, ASSIGNMENT_SPECS[5]!, {
        title:
          "Extended Brief: Research-Led Design Proposal With A Deliberately Long Title To Test Truncation In Tables And Cards",
        status: "PUBLISHED",
        deadline: daysAhead(20),
        publishedAt: daysAgo(10),
        brief: `${ASSIGNMENT_SPECS[5]!.brief}\n\n${"Additional requirements: document every iteration, cite all references, and include a reflective note. ".repeat(25).trim()}`,
        rules: FILE_RULES[1],
      });
    }
  }
  // An assignment with no subject at all — open to everyone, no course gate.
  addAssignment("open-sketch-challenge", null, ASSIGNMENT_SPECS[9]!, {
    title: "Open Challenge: 10-Minute Window Sketch",
    status: "PUBLISHED",
    deadline: null,
    publishedAt: daysAgo(90),
    rules: FILE_RULES[1],
  });

  await insert("assignment templates", templates, (data) =>
    prisma.assignmentTemplate.createMany({ data, skipDuplicates: true }),
  );
  await insert("assignments", assignments, (data) =>
    prisma.assignment.createMany({ data, skipDuplicates: true }),
  );
  await insert("rubric criteria", criteria, (data) =>
    prisma.rubricCriterion.createMany({ data, skipDuplicates: true }),
  );
}

interface PlannedFile {
  row: Prisma.SubmissionFileCreateManyInput;
  bytes: Buffer | null;
}

async function seedSubmissions(ctx: Ctx): Promise<void> {
  const assignments = await prisma.assignment.findMany({
    where: { status: { in: ["PUBLISHED", "ARCHIVED"] }, deletedAt: null },
    include: { criteria: { orderBy: { position: "asc" } } },
    orderBy: { slug: "asc" },
  });

  // Reviewer pool: the two known logins get a solid share so their queues are
  // well populated; the rest is spread over bulk reviewers and mentors.
  const others = [...ctx.reviewers, ...ctx.mentors].map((u) => u.id);
  const pickReviewer = (r: Rng): string =>
    weighted(r, [
      [ctx.demo.mentorId, 15],
      [ctx.reviewerLogin.id, 15],
      ...others.map((id) => [id, 70 / Math.max(1, others.length)] as const),
    ]);

  const submissions: Prisma.AssignmentSubmissionCreateManyInput[] = [];
  const reviews: Prisma.AssignmentReviewCreateManyInput[] = [];
  const scores: Prisma.RubricScoreCreateManyInput[] = [];
  const comments: Prisma.AssignmentCommentCreateManyInput[] = [];
  const files: PlannedFile[] = [];

  type Outcome = "DRAFT" | "OPEN" | "ASSIGNED" | "UNDER_REVIEW" | "APPROVED" | "REVISION";

  for (const assignment of assignments) {
    if (assignment.criteria.length === 0) continue;
    const courseId = assignment.subjectId
      ? ctx.courseBySubject.get(assignment.subjectId)
      : undefined;
    if (assignment.subjectId && !courseId) continue;
    const rules = assignment.fileRules as { allowedMimeTypes?: string[]; maxFiles?: number };
    const allowsPdf = rules.allowedMimeTypes?.includes("application/pdf") ?? true;
    const allowsPng = rules.allowedMimeTypes?.some((m) => m.startsWith("image/")) ?? true;
    const maxFiles = Math.min(3, rules.maxFiles ?? 3);
    const archived = assignment.status === "ARCHIVED";

    for (const student of ctx.students) {
      if (!isActiveUser(student) && student.status !== "INACTIVE") continue;
      const enr = courseId ? accessibleEnrollment(ctx, student.id, courseId) : undefined;
      if (courseId && !enr) continue;
      const r = rng(`submission:${student.email}:${assignment.id}`);
      if (!chance(r, (archived ? 0.35 : 0.2) + student.diligence * 0.55)) continue;

      const opensAt = plus(
        later(enr?.enrolledAt ?? student.createdAt, assignment.publishedAt ?? student.createdAt),
        HOUR,
      );
      const deadline = assignment.deadline;
      const late = deadline !== null && deadline.getTime() < NOW && chance(r, 0.12);
      const closesAt = late
        ? notFuture(plus(deadline!, int(r, 1, 72) * HOUR))
        : deadline
          ? earlier(deadline, at(NOW - HOUR))
          : at(NOW - HOUR);
      if (closesAt.getTime() <= opensAt.getTime()) continue;

      let reviewerId = pickReviewer(r);
      let createdAt = between(r, opensAt, closesAt);

      for (let version = 1; version <= 3; version++) {
        const submissionId = bid(`submission:${student.email}:${assignment.id}:v${version}`);
        let outcome: Outcome =
          version === 1
            ? weighted(r, [
                ["DRAFT", 7],
                ["OPEN", 10],
                ["ASSIGNED", 10],
                ["UNDER_REVIEW", 10],
                ["APPROVED", 43],
                ["REVISION", 20],
              ] as const)
            : weighted(r, [
                ["DRAFT", 15],
                ["ASSIGNED", 15],
                ["UNDER_REVIEW", 10],
                ["APPROVED", 45],
                ["REVISION", version === 3 ? 0 : 15],
              ] as const);
        if (
          archived &&
          (outcome === "DRAFT" ||
            outcome === "OPEN" ||
            outcome === "ASSIGNED" ||
            outcome === "UNDER_REVIEW")
        )
          outcome = "APPROVED";

        const submittedAt =
          outcome === "DRAFT" ? null : notFuture(plus(createdAt, int(r, 10, 240) * MINUTE));
        // A review needs time to have happened; very fresh submissions stay in the queue.
        const reviewedAt = submittedAt
          ? notFuture(plus(submittedAt, int(r, 2, 7 * 24) * HOUR))
          : null;
        if (
          (outcome === "APPROVED" || outcome === "REVISION") &&
          submittedAt &&
          reviewedAt!.getTime() - submittedAt.getTime() < HOUR
        ) {
          outcome = "ASSIGNED";
        }

        const status =
          outcome === "DRAFT"
            ? "DRAFT"
            : outcome === "OPEN" || outcome === "ASSIGNED"
              ? "SUBMITTED"
              : outcome === "UNDER_REVIEW"
                ? "UNDER_REVIEW"
                : outcome === "APPROVED"
                  ? "APPROVED"
                  : "REVISION_REQUESTED";

        submissions.push({
          id: submissionId,
          assignmentId: assignment.id,
          studentId: student.id,
          version,
          status,
          notes: pick(r, SUBMISSION_NOTES),
          reviewerId: outcome === "DRAFT" || outcome === "OPEN" ? null : reviewerId,
          submittedAt,
          createdAt,
        });

        // Files: drafts may have 0-1, everything submitted has 1..maxFiles.
        const fileCount = outcome === "DRAFT" ? int(r, 0, 1) : int(r, 1, maxFiles);
        for (let f = 0; f < fileCount; f++) {
          const usePdf = allowsPdf && (!allowsPng || chance(r, 0.5));
          const fileName = usePdf ? pick(r, FILE_NAMES_PDF) : pick(r, FILE_NAMES_PNG);
          const scanStatus =
            outcome === "DRAFT"
              ? weighted(r, [
                  ["CLEAN", 80],
                  ["PENDING", 20],
                ] as const)
              : weighted(r, [
                  ["CLEAN", 90],
                  ["PENDING", 4],
                  ["FAILED", 3],
                  ["INFECTED", 3],
                ] as const);
          const fileId = bid(`file:${submissionId}:${f}`);
          const bytes =
            scanStatus === "CLEAN"
              ? usePdf
                ? pdfBytes(`${assignment.title} — ${fileName}`)
                : PNG_BYTES
              : null;
          files.push({
            bytes,
            row: {
              id: fileId,
              submissionId,
              fileName,
              mimeType: usePdf ? "application/pdf" : "image/png",
              sizeBytes: bytes ? bytes.length : int(r, 80_000, 9_000_000),
              storageKey: `bulk-seed/assignments/${submissionId}/${fileId.slice(0, 8)}-${fileName}`,
              scanStatus,
              uploadedAt: plus(createdAt, f * MINUTE),
            },
          });
        }

        if (outcome === "UNDER_REVIEW" || outcome === "APPROVED" || outcome === "REVISION") {
          const reviewId = bid(`review:${submissionId}`);
          const published = outcome !== "UNDER_REVIEW";
          const quality = clamp(
            student.skill * (outcome === "REVISION" ? 0.6 : 1) + 0.1 + (r() - 0.5) * 0.2,
            0.15,
            1,
          );
          // Draft reviews may be partially scored (a reviewer saved progress midway).
          const scored = published
            ? assignment.criteria
            : assignment.criteria.slice(0, Math.max(1, int(r, 1, assignment.criteria.length)));
          let total = 0;
          for (const c of scored) {
            const max = Number(c.maxMarks);
            const awarded = clamp(
              Math.round(max * clamp(quality + (r() - 0.5) * 0.2, 0, 1) * 2) / 2,
              0,
              max,
            );
            total += awarded;
            scores.push({
              id: bid(`score:${reviewId}:${c.id}`),
              reviewId,
              criterionId: c.id,
              marksAwarded: awarded,
              comment: pick(r, RUBRIC_COMMENTS),
            });
          }
          reviews.push({
            id: reviewId,
            submissionId,
            reviewerId,
            status: published ? "PUBLISHED" : "DRAFT",
            overallComment:
              outcome === "REVISION"
                ? pick(r, REVIEW_COMMENTS_REVISE)
                : published || chance(r, 0.5)
                  ? pick(r, REVIEW_COMMENTS_GOOD)
                  : null,
            decision:
              outcome === "APPROVED"
                ? "APPROVED"
                : outcome === "REVISION"
                  ? "REVISION_REQUESTED"
                  : null,
            obtainedMarks: published ? total : null,
            publishedAt: published ? reviewedAt : null,
            createdAt: reviewedAt ?? at(NOW),
          });
        }

        if (submittedAt && chance(r, 0.35)) {
          const n = int(r, 1, 4);
          let t = submittedAt;
          for (let k = 0; k < n; k++) {
            t = notFuture(plus(t, int(r, 1, 48) * HOUR));
            const fromStudent = k % 2 === 0;
            comments.push({
              id: bid(`comment:${submissionId}:${k}`),
              submissionId,
              authorId: fromStudent || outcome === "OPEN" ? student.id : reviewerId,
              body: SUBMISSION_THREAD[(k + (fromStudent ? 0 : 1)) % SUBMISSION_THREAD.length]!,
              createdAt: t,
            });
          }
        }

        if (outcome !== "REVISION") break;
        // Resubmission happens a few days after the revision request — or not
        // yet, leaving REVISION_REQUESTED as the student's latest state.
        const next = plus(reviewedAt!, int(r, 1, 6) * DAY);
        if (next.getTime() >= NOW - HOUR || chance(r, 0.15)) break;
        createdAt = next;
        if (chance(r, 0.2)) reviewerId = pickReviewer(r);
      }
    }
  }

  await insert("assignment submissions", submissions, (data) =>
    prisma.assignmentSubmission.createMany({ data, skipDuplicates: true }),
  );
  await insert("assignment reviews", reviews, (data) =>
    prisma.assignmentReview.createMany({ data, skipDuplicates: true }),
  );
  await insert("rubric scores", scores, (data) =>
    prisma.rubricScore.createMany({ data, skipDuplicates: true }),
  );
  await insert("assignment comments", comments, (data) =>
    prisma.assignmentComment.createMany({ data, skipDuplicates: true }),
  );
  await seedSubmissionFiles(files);
}

/** Uploads CLEAN files for real (skipping ones already recorded), then inserts rows. */
async function seedSubmissionFiles(files: PlannedFile[]): Promise<void> {
  const existing = new Set(
    (
      await prisma.submissionFile.findMany({
        where: { id: { in: files.map((f) => f.row.id!) } },
        select: { id: true },
      })
    ).map((f) => f.id),
  );
  const pending = files.filter((f) => !existing.has(f.row.id!));
  const toUpload = pending.filter((f) => f.bytes !== null);
  const rows = pending.filter((f) => f.bytes === null).map((f) => f.row);

  if (toUpload.length > 0) {
    const client = new S3Client({
      endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
      region: process.env.S3_REGION ?? "us-east-1",
      forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      },
    });
    const bucket = process.env.S3_BUCKET ?? "examora-uploads";
    let reachable = false;
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }), {
        abortSignal: AbortSignal.timeout(3000),
      });
      reachable = true;
    } catch {
      reachable = false;
    }

    if (!reachable) {
      log(
        `  S3/MinIO unavailable — skipped ${toUpload.length} CLEAN submission files (no non-downloadable records created).`,
      );
    } else {
      let failed = 0;
      for (let i = 0; i < toUpload.length; i += 25) {
        const batch = toUpload.slice(i, i + 25);
        const results = await Promise.allSettled(
          batch.map((f) =>
            client.send(
              new PutObjectCommand({
                Bucket: bucket,
                Key: f.row.storageKey,
                Body: f.bytes!,
                ContentType: f.row.mimeType,
              }),
              { abortSignal: AbortSignal.timeout(10_000) },
            ),
          ),
        );
        results.forEach((res, k) => {
          if (res.status === "fulfilled") rows.push(batch[k]!.row);
          else failed++;
        });
      }
      log(
        `  Uploaded ${toUpload.length - failed} submission files to S3/MinIO${failed ? ` (${failed} failed and were skipped)` : ""}.`,
      );
    }
    client.destroy();
  }

  await insert("submission files", rows, (data) =>
    prisma.submissionFile.createMany({ data, skipDuplicates: true }),
  );
}

// ---------------------------------------------------------------------------
// 7. Mentoring
// ---------------------------------------------------------------------------

async function seedMentoring(ctx: Ctx): Promise<void> {
  const assignmentsRows: Prisma.MentorAssignmentCreateManyInput[] = [];
  const notes: Prisma.MentorNoteCreateManyInput[] = [];
  const tasks: Prisma.MentorTaskCreateManyInput[] = [];
  const feedback: Prisma.MentorFeedbackCreateManyInput[] = [];
  const meetings: Prisma.MentorMeetingCreateManyInput[] = [];

  // The last bulk mentor is left with no students (an idle mentor edge case).
  const pool = ctx.mentors.slice(0, Math.max(1, ctx.mentors.length - 1));
  const adminIds = [ctx.demo.adminId, ...ctx.admins.map((a) => a.id)];
  const eligible = ctx.students.filter((s) => s.status === "ACTIVE" || s.status === "INACTIVE");

  // Remaining capacity per mentor (maxStudents minus current active load).
  const capacity = new Map(
    (
      await prisma.mentorProfile.findMany({
        where: { userId: { in: pool.map((m) => m.id) } },
        select: { userId: true, maxStudents: true },
      })
    ).map((p) => [p.userId, p.maxStudents]),
  );

  eligible.forEach((student, i) => {
    const r = rng(`mentoring:${student.email}`);
    let mentorId: string;
    // Demo mentor fills up to its capacity (10 incl. the demo student);
    // mentor001 is deliberately pushed past its capacity of 5 (over-capacity
    // edge case). Everyone else respects maxStudents, and students left over
    // when every mentor is full simply stay unassigned.
    if (i < 9) mentorId = ctx.demo.mentorId;
    else if (i < 16) mentorId = pool[0]!.id;
    else {
      const open = pool.slice(1).filter((m) => (capacity.get(m.id) ?? 0) > 0);
      if (open.length === 0 || !chance(r, 0.85)) return;
      mentorId = pick(r, open).id;
      capacity.set(mentorId, capacity.get(mentorId)! - 1);
    }

    const assignedAt = between(r, plus(student.createdAt, DAY), daysAgo(3));
    const assignedById = pick(r, adminIds);

    if (chance(r, 0.15) && pool.length > 1) {
      const previous = pick(
        r,
        pool.filter((m) => m.id !== mentorId),
      ).id;
      const prevAssignedAt = between(r, student.createdAt, assignedAt);
      assignmentsRows.push({
        id: bid(`mentor-assignment:${student.email}:prev`),
        studentId: student.id,
        mentorId: previous,
        assignedById,
        assignedAt: prevAssignedAt,
        unassignedAt: assignedAt,
      });
    }
    assignmentsRows.push({
      id: bid(`mentor-assignment:${student.email}`),
      studentId: student.id,
      mentorId,
      assignedById,
      assignedAt,
      unassignedAt: null,
    });

    const when = (): Date => between(r, assignedAt, at(NOW - HOUR));
    for (let k = 0, n = int(r, 0, 4); k < n; k++) {
      const createdAt = when();
      notes.push({
        id: bid(`mentor-note:${student.email}:${k}`),
        studentId: student.id,
        mentorId,
        body: pick(r, MENTOR_NOTES),
        createdAt,
      });
    }
    for (let k = 0, n = int(r, 0, 5); k < n; k++) {
      const createdAt = when();
      const status = weighted(r, [
        ["PENDING", 35],
        ["IN_PROGRESS", 25],
        ["COMPLETED", 40],
      ] as const);
      // Pending tasks may be overdue (due date already passed).
      const dueDate = chance(r, 0.15)
        ? null
        : status === "COMPLETED"
          ? plus(createdAt, int(r, 2, 14) * DAY)
          : chance(r, 0.35)
            ? daysAgo(int(r, 1, 10))
            : daysAhead(int(r, 1, 21));
      tasks.push({
        id: bid(`mentor-task:${student.email}:${k}`),
        studentId: student.id,
        mentorId,
        title: pick(r, MENTOR_TASKS),
        description: chance(r, 0.5)
          ? "Discussed in our last session — reach out if you get stuck."
          : null,
        dueDate,
        status,
        completedAt: status === "COMPLETED" ? between(r, createdAt, at(NOW)) : null,
        createdAt,
      });
    }
    for (let k = 0, n = int(r, 0, 3); k < n; k++) {
      feedback.push({
        id: bid(`mentor-feedback:${student.email}:${k}`),
        studentId: student.id,
        mentorId,
        body: pick(r, MENTOR_FEEDBACK),
        createdAt: when(),
      });
    }
    for (let k = 0, n = int(r, 0, 4); k < n; k++) {
      const occurredAt = when();
      meetings.push({
        id: bid(`mentor-meeting:${student.email}:${k}`),
        studentId: student.id,
        mentorId,
        occurredAt,
        durationMinutes: chance(r, 0.9) ? pick(r, [15, 20, 30, 45, 60]) : null,
        summary: pick(r, MEETING_SUMMARIES),
        createdAt: occurredAt,
      });
    }
  });

  await insert("mentor assignments", assignmentsRows, (data) =>
    prisma.mentorAssignment.createMany({ data, skipDuplicates: true }),
  );
  await insert("mentor notes", notes, (data) =>
    prisma.mentorNote.createMany({ data, skipDuplicates: true }),
  );
  await insert("mentor tasks", tasks, (data) =>
    prisma.mentorTask.createMany({ data, skipDuplicates: true }),
  );
  await insert("mentor feedback", feedback, (data) =>
    prisma.mentorFeedback.createMany({ data, skipDuplicates: true }),
  );
  await insert("mentor meetings", meetings, (data) =>
    prisma.mentorMeeting.createMany({ data, skipDuplicates: true }),
  );
}

// ---------------------------------------------------------------------------
// 8. Community
// ---------------------------------------------------------------------------

async function seedCommunity(ctx: Ctx): Promise<void> {
  const creator = ctx.admins[0]!.id;
  const categoryId = bid("forum-category:study-groups");
  await insert(
    "forum categories",
    [
      {
        id: categoryId,
        title: "Study Groups",
        slug: "bulk-study-groups",
        description: "Find peers preparing for the same exam.",
        position: 50,
        createdById: creator,
      },
    ],
    (data) => prisma.forumCategory.createMany({ data, skipDuplicates: true }),
  );
  const newBoards = [
    { key: "nift-2027", title: "NIFT 2027 Aspirants", isActive: true },
    { key: "portfolio-critique", title: "Portfolio Critique", isActive: true },
    { key: "off-topic", title: "Off-topic Lounge", isActive: true },
    { key: "retired", title: "Retired Board (inactive)", isActive: false },
  ];
  await insert(
    "forum boards",
    newBoards.map((b, position) => ({
      id: bid(`forum-board:${b.key}`),
      categoryId,
      title: b.title,
      slug: `bulk-${b.key}`,
      isActive: b.isActive,
      position,
      createdById: creator,
    })),
    (data) => prisma.forumBoard.createMany({ data, skipDuplicates: true }),
  );

  const boards = (
    await prisma.forumBoard.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true },
    })
  ).map((b) => b.id);
  const lessons = ctx.courses.flatMap((c) => c.lessonIds);
  const quizzes = (
    await prisma.quiz.findMany({ where: { status: "PUBLISHED" }, select: { id: true } })
  ).map((q) => q.id);
  const assignments = (
    await prisma.assignment.findMany({ where: { status: "PUBLISHED" }, select: { id: true } })
  ).map((a) => a.id);
  const moderators = [ctx.demo.adminId, ...ctx.admins.map((a) => a.id)];

  const authors = ctx.students.filter(isActiveUser);
  // Only bulk users take part, so demo accounts' reputation stays consistent
  // and --clean removes every row created here.
  const people = [...authors.map((s) => s.id), ...ctx.mentors.map((m) => m.id)];
  const mentorIds = new Set(ctx.mentors.map((m) => m.id));
  const createdAtOf = new Map([...ctx.students, ...ctx.mentors].map((u) => [u.id, u.createdAt]));

  const threads: Prisma.ThreadCreateManyInput[] = [];
  const replies: Prisma.ReplyCreateManyInput[] = [];
  const likes: Prisma.CommunityLikeCreateManyInput[] = [];
  const bookmarks: Prisma.CommunityBookmarkCreateManyInput[] = [];
  const follows: Prisma.ThreadFollowCreateManyInput[] = [];
  const reports: Prisma.CommunityReportCreateManyInput[] = [];
  const reputation = new Map<
    string,
    { points: number; events: Prisma.ReputationEventCreateManyInput[] }
  >();
  const award = (
    userId: string,
    points: number,
    reason: string,
    createdAt: Date,
    key: string,
  ): void => {
    const entry = reputation.get(userId) ?? { points: 0, events: [] };
    entry.points += points;
    entry.events.push({ id: bid(`rep:${key}`), userId, points, reason, createdAt });
    reputation.set(userId, entry);
  };

  const threadCount = Math.round(ctx.students.length * 0.6);
  for (let t = 0; t < threadCount; t++) {
    const r = rng(`thread:${t}`);
    const isQuestion = chance(r, 0.5);
    const authorId = chance(r, 0.12) ? pick(r, [...mentorIds]) : pick(r, authors).id;
    const createdAt = between(r, createdAtOf.get(authorId) ?? daysAgo(180), at(NOW - 2 * HOUR));
    const id = bid(`thread:${t}`);
    const hidden = chance(r, 0.03);
    const related = isQuestion
      ? weighted(r, [
          ["course", 30],
          ["lesson", 25],
          ["quiz", 15],
          ["assignment", 20],
          ["none", 10],
        ] as const)
      : "none";

    threads.push({
      id,
      boardId: pick(r, boards),
      authorId,
      type: isQuestion ? "QUESTION" : "DISCUSSION",
      title:
        t === 1
          ? `${pick(r, THREAD_DISCUSSIONS)} (long post)`
          : isQuestion
            ? pick(r, THREAD_QUESTIONS)
            : pick(r, THREAD_DISCUSSIONS),
      body: t === 1 ? LONG_BODY : pick(r, THREAD_BODIES),
      status: chance(r, 0.1) ? "CLOSED" : "OPEN",
      isPinned: t < 2 || chance(r, 0.02),
      isLocked: chance(r, 0.04),
      isHidden: hidden,
      hiddenReason: hidden ? pick(r, HIDDEN_REASONS) : null,
      moderatedById: hidden ? pick(r, moderators) : null,
      isSolved: false, // set below once we know whether an answer was accepted
      viewCount: int(r, 0, 900),
      relatedCourseId: related === "course" ? pick(r, ctx.courses).id : null,
      relatedLessonId: related === "lesson" && lessons.length ? pick(r, lessons) : null,
      relatedQuizId: related === "quiz" && quizzes.length ? pick(r, quizzes) : null,
      relatedAssignmentId:
        related === "assignment" && assignments.length ? pick(r, assignments) : null,
      createdAt,
      deletedAt: chance(r, 0.02) ? between(r, createdAt, at(NOW)) : null,
    });
    award(
      authorId,
      5,
      isQuestion ? "Posted a question" : "Started a discussion thread",
      createdAt,
      `thread:${t}`,
    );
    follows.push({ id: bid(`follow:${t}:${authorId}`), userId: authorId, threadId: id, createdAt });

    // Thread 0 gets 45 replies to exercise reply pagination.
    const replyCount =
      t === 0
        ? 45
        : weighted(r, [
            [0, 15],
            [1, 15],
            [2, 15],
            [3, 15],
            [5, 15],
            [8, 15],
            [12, 10],
          ] as const);
    const topLevel: string[] = [];
    const threadReplies: { id: string; authorId: string; createdAt: Date }[] = [];
    let rt = createdAt;
    for (let k = 0; k < replyCount; k++) {
      const replyId = bid(`reply:${t}:${k}`);
      const replyAuthor = chance(r, 0.2) ? pick(r, [...mentorIds]) : pick(r, people);
      rt = notFuture(plus(rt, int(r, 5, 36 * 60) * MINUTE));
      const nested = topLevel.length > 0 && chance(r, 0.25);
      const replyHidden = chance(r, 0.02);
      replies.push({
        id: replyId,
        threadId: id,
        authorId: replyAuthor,
        parentReplyId: nested ? pick(r, topLevel) : null,
        body: pick(r, REPLY_BODIES),
        isHidden: replyHidden,
        hiddenReason: replyHidden ? pick(r, HIDDEN_REASONS) : null,
        moderatedById: replyHidden ? pick(r, moderators) : null,
        createdAt: rt,
      });
      if (!nested) topLevel.push(replyId);
      threadReplies.push({ id: replyId, authorId: replyAuthor, createdAt: rt });
      award(replyAuthor, 5, "Replied to a thread", rt, `reply:${t}:${k}`);
    }

    // Accepted answer on ~60% of answered questions, preferring a mentor's reply.
    const candidates = threadReplies.filter((rep) => rep.authorId !== authorId);
    if (isQuestion && candidates.length > 0 && chance(r, 0.6)) {
      const accepted = candidates.find((c) => mentorIds.has(c.authorId)) ?? pick(r, candidates);
      const row = replies.find((rep) => rep.id === accepted.id)!;
      row.isAcceptedAnswer = true;
      threads[threads.length - 1]!.isSolved = true;
      award(
        accepted.authorId,
        15,
        "Answer accepted",
        notFuture(plus(accepted.createdAt, HOUR)),
        `accepted:${t}`,
      );
    }

    // Likes, bookmarks, follows from a random audience.
    const audience = sample(r, people, int(r, 0, Math.min(25, people.length)));
    for (const userId of audience) {
      if (userId !== authorId && chance(r, 0.6))
        likes.push({
          id: bid(`like:thread:${t}:${userId}`),
          userId,
          targetType: "THREAD",
          targetId: id,
          createdAt: between(r, createdAt, at(NOW)),
        });
      if (chance(r, 0.15))
        bookmarks.push({
          id: bid(`bookmark:${t}:${userId}`),
          userId,
          threadId: id,
          createdAt: between(r, createdAt, at(NOW)),
        });
      if (userId !== authorId && chance(r, 0.2))
        follows.push({
          id: bid(`follow:${t}:${userId}`),
          userId,
          threadId: id,
          createdAt: between(r, createdAt, at(NOW)),
        });
    }
    for (const rep of threadReplies) {
      for (const userId of sample(r, people, int(r, 0, 4))) {
        if (userId !== rep.authorId)
          likes.push({
            id: bid(`like:reply:${rep.id}:${userId}`),
            userId,
            targetType: "REPLY",
            targetId: rep.id,
            createdAt: between(r, rep.createdAt, at(NOW)),
          });
      }
    }

    // Moderation queue: reports in every state.
    const report = (
      targetType: "THREAD" | "REPLY",
      targetId: string,
      after: Date,
      key: string,
    ): void => {
      const status = weighted(r, [
        ["PENDING", 50],
        ["REVIEWED", 30],
        ["DISMISSED", 20],
      ] as const);
      const reportedAt = between(r, after, at(NOW));
      reports.push({
        id: bid(`report:${key}`),
        reporterId: pick(r, authors).id,
        targetType,
        targetId,
        reason: pick(r, REPORT_REASONS),
        status,
        reviewedById: status === "PENDING" ? null : pick(r, moderators),
        reviewedAt: status === "PENDING" ? null : notFuture(plus(reportedAt, int(r, 1, 48) * HOUR)),
        createdAt: reportedAt,
      });
    };
    if (hidden || chance(r, 0.04)) report("THREAD", id, createdAt, `thread:${t}`);
    for (const rep of threadReplies)
      if (chance(r, 0.02)) report("REPLY", rep.id, rep.createdAt, `reply:${rep.id}`);
  }

  // Likes earn the receiver reputation, matching the running ledger.
  const authorOf = new Map<string, string>([
    ...threads.map((t) => [t.id!, t.authorId] as const),
    ...replies.map((rep) => [rep.id!, rep.authorId] as const),
  ]);
  for (const like of likes) {
    const receiver = authorOf.get(like.targetId);
    if (receiver) award(receiver, 2, "Received a like", like.createdAt as Date, `like:${like.id}`);
  }

  const profiles: Prisma.CommunityProfileCreateManyInput[] = [...reputation.entries()].map(
    ([userId, e]) => ({
      id: bid(`community-profile:${userId}`),
      userId,
      reputationPoints: e.points,
    }),
  );
  const events = [...reputation.values()].flatMap((e) => e.events);

  await insert("threads", threads, (data) =>
    prisma.thread.createMany({ data, skipDuplicates: true }),
  );
  await insert(
    "replies",
    replies.filter((rep) => !rep.parentReplyId),
    (data) => prisma.reply.createMany({ data, skipDuplicates: true }),
  );
  await insert(
    "replies",
    replies.filter((rep) => rep.parentReplyId),
    (data) => prisma.reply.createMany({ data, skipDuplicates: true }),
  );
  await insert("community likes", likes, (data) =>
    prisma.communityLike.createMany({ data, skipDuplicates: true }),
  );
  await insert("community bookmarks", bookmarks, (data) =>
    prisma.communityBookmark.createMany({ data, skipDuplicates: true }),
  );
  await insert("thread follows", follows, (data) =>
    prisma.threadFollow.createMany({ data, skipDuplicates: true }),
  );
  await insert("community reports", reports, (data) =>
    prisma.communityReport.createMany({ data, skipDuplicates: true }),
  );
  await insert("community profiles", profiles, (data) =>
    prisma.communityProfile.createMany({ data, skipDuplicates: true }),
  );
  await insert("reputation events", events, (data) =>
    prisma.reputationEvent.createMany({ data, skipDuplicates: true }),
  );
}

// ---------------------------------------------------------------------------
// 9. Notifications, deliveries, preferences
// ---------------------------------------------------------------------------

type NotificationDef = [eventType: string, category: string, title: string, body: string];

const STUDENT_NOTIFICATIONS: NotificationDef[] = [
  [
    "assignment.review_published",
    "assignments",
    "Your submission was approved",
    "Feedback is ready for your latest assignment.",
  ],
  [
    "assignment.review_published",
    "assignments",
    "Revision requested",
    "Your reviewer has asked for a few changes.",
  ],
  [
    "assignment.pending_reminder",
    "assignments",
    "Assignment due soon",
    "You have an assignment due in the next 48 hours.",
  ],
  [
    "quiz.attempt_scored",
    "assessment",
    "Quiz result available",
    "Your latest quiz attempt has been scored.",
  ],
  [
    "enrollment.granted",
    "commerce",
    "You're enrolled!",
    "Your course is now available in My Learning.",
  ],
  [
    "commerce.payment_success",
    "commerce",
    "Payment received",
    "Thanks! Your payment was successful and your invoice is ready.",
  ],
  [
    "commerce.payment_failed",
    "commerce",
    "Payment failed",
    "We couldn't process your payment. Please try again.",
  ],
  [
    "community.reply_received",
    "community",
    "New reply to your thread",
    "Someone replied to a thread you follow.",
  ],
  [
    "learning.progress_reminder",
    "learning",
    "Pick up where you left off",
    "You're halfway through a course — keep going!",
  ],
  [
    "mentoring.feedback_received",
    "mentoring",
    "New feedback from your mentor",
    "Your mentor shared feedback on your progress.",
  ],
  [
    "mentoring.task_assigned",
    "mentoring",
    "New task from your mentor",
    "Your mentor assigned you a new task.",
  ],
  [
    "cms.announcement_published",
    "cms",
    "New announcement",
    "Mock exam schedule for next month is now live.",
  ],
  [
    "recommendation.course_suggested",
    "recommendations",
    "A course you might like",
    "Based on your progress, we picked a course for you.",
  ],
];
const STAFF_NOTIFICATIONS: NotificationDef[] = [
  [
    "assignment.submission_ready_for_review",
    "assignments",
    "Submission ready for review",
    "A new submission has been assigned to you.",
  ],
  [
    "mentoring.student_assigned",
    "mentoring",
    "New student assigned",
    "A student has been added to your mentoring list.",
  ],
  [
    "mentoring.meeting_reminder",
    "mentoring",
    "Upcoming session",
    "You have a mentoring session tomorrow.",
  ],
  [
    "community.reply_received",
    "community",
    "New reply to your answer",
    "A student replied to your answer.",
  ],
];
const ADMIN_NOTIFICATIONS: NotificationDef[] = [
  [
    "community.report_filed",
    "community",
    "New content report",
    "A post was reported and is waiting in the moderation queue.",
  ],
  ["commerce.refund_requested", "commerce", "Refund requested", "A student requested a refund."],
  [
    "reports.scheduled_ready",
    "reports",
    "Scheduled report ready",
    "Your weekly report has been generated.",
  ],
];
const GUARDIAN_NOTIFICATIONS: NotificationDef[] = [
  [
    "guardian.progress_summary",
    "learning",
    "Weekly progress summary",
    "Here's how your ward did this week.",
  ],
  [
    "guardian.attendance_alert",
    "mentoring",
    "Missed mentoring session",
    "Your ward missed a scheduled mentoring session.",
  ],
];

async function seedNotifications(ctx: Ctx): Promise<void> {
  const notifications: Prisma.NotificationCreateManyInput[] = [];
  const deliveries: Prisma.NotificationDeliveryCreateManyInput[] = [];
  const preferences: Prisma.NotificationPreferenceCreateManyInput[] = [];

  const recipients: {
    id: string;
    key: string;
    since: Date;
    defs: NotificationDef[];
    count: [number, number];
    prefs: boolean;
  }[] = [
    ...ctx.students
      .filter((s) => s.status !== "PENDING_VERIFICATION")
      .map((s) => ({
        id: s.id,
        key: s.email,
        since: s.createdAt,
        defs: STUDENT_NOTIFICATIONS,
        count: [2, 18] as [number, number],
        prefs: true,
      })),
    ...[...ctx.mentors, ...ctx.reviewers, ctx.reviewerLogin].map((u) => ({
      id: u.id,
      key: u.email,
      since: u.createdAt,
      defs: STAFF_NOTIFICATIONS,
      count: [5, 25] as [number, number],
      prefs: true,
    })),
    ...ctx.admins.map((u) => ({
      id: u.id,
      key: u.email,
      since: u.createdAt,
      defs: ADMIN_NOTIFICATIONS,
      count: [5, 20] as [number, number],
      prefs: true,
    })),
    ...[...ctx.guardians, ctx.guardianLogin].map((u) => ({
      id: u.id,
      key: u.email,
      since: u.createdAt,
      defs: GUARDIAN_NOTIFICATIONS,
      count: [2, 10] as [number, number],
      prefs: true,
    })),
    // Demo logins get a long list so the notification center paginates. Their
    // preferences are left alone (seed.ts / the user owns them).
    {
      id: ctx.demo.studentId,
      key: "demo-student",
      since: daysAgo(120),
      defs: STUDENT_NOTIFICATIONS,
      count: [45, 45],
      prefs: false,
    },
    {
      id: ctx.demo.mentorId,
      key: "demo-mentor",
      since: daysAgo(120),
      defs: STAFF_NOTIFICATIONS,
      count: [35, 35],
      prefs: false,
    },
    {
      id: ctx.demo.adminId,
      key: "demo-admin",
      since: daysAgo(120),
      defs: ADMIN_NOTIFICATIONS,
      count: [30, 30],
      prefs: false,
    },
  ];

  for (const rec of recipients) {
    const r = rng(`notifications:${rec.key}`);
    const n = int(r, rec.count[0], rec.count[1]);
    for (let k = 0; k < n; k++) {
      const [eventType, category, title, body] = pick(r, rec.defs);
      const createdAt = between(r, rec.since, at(NOW - 5 * MINUTE));
      const ageDays = (NOW - createdAt.getTime()) / DAY;
      const isRead = chance(r, ageDays > 7 ? 0.8 : 0.35);
      const id = bid(`notification:${rec.key}:${k}`);
      notifications.push({
        id,
        userId: rec.id,
        eventType,
        category,
        title,
        body,
        data: { bulkSeed: true },
        isTransactional: category === "commerce" && eventType.startsWith("commerce.payment"),
        isRead,
        readAt: isRead ? between(r, createdAt, at(NOW)) : null,
        createdAt,
      });

      const sentAt = plus(createdAt, int(r, 1, 30) * 1000);
      deliveries.push({
        id: bid(`delivery:${id}:in-app`),
        notificationId: id,
        channel: "IN_APP",
        status: isRead ? "OPENED" : "DELIVERED",
        attempts: 1,
        queuedAt: createdAt,
        sentAt,
        deliveredAt: sentAt,
        openedAt: isRead ? between(r, sentAt, at(NOW)) : null,
        createdAt,
      });
      if (chance(r, 0.7)) {
        const status = weighted(r, [
          ["DELIVERED", 48],
          ["OPENED", 20],
          ["CLICKED", 8],
          ["SENT", 8],
          ["FAILED", 5],
          ["SUPPRESSED", 4],
          ["QUEUED", ageDays < 1 ? 20 : 0],
          ["RETRIED", 3],
        ] as const);
        const delivered = ["DELIVERED", "OPENED", "CLICKED"].includes(status);
        deliveries.push({
          id: bid(`delivery:${id}:email`),
          notificationId: id,
          channel: "EMAIL",
          status,
          attempts:
            status === "FAILED"
              ? 3
              : status === "RETRIED"
                ? 2
                : status === "QUEUED" || status === "SUPPRESSED"
                  ? 0
                  : 1,
          lastError:
            status === "FAILED" || status === "RETRIED"
              ? pick(r, ["550 Mailbox unavailable", "SMTP timeout", "Rate limited by provider"])
              : null,
          providerMessageId:
            status === "QUEUED" || status === "SUPPRESSED"
              ? null
              : `bulk-msg-${hex(`msg:${id}`).slice(0, 16)}`,
          suppressedReason:
            status === "SUPPRESSED"
              ? pick(r, [
                  "User opted out of email",
                  "Inside do-not-disturb window",
                  "Category muted",
                ])
              : null,
          queuedAt: createdAt,
          sentAt: status === "QUEUED" || status === "SUPPRESSED" ? null : sentAt,
          deliveredAt: delivered ? plus(sentAt, 2000) : null,
          openedAt:
            status === "OPENED" || status === "CLICKED"
              ? notFuture(plus(sentAt, int(r, 1, 600) * MINUTE))
              : null,
          clickedAt:
            status === "CLICKED" ? notFuture(plus(sentAt, int(r, 601, 900) * MINUTE)) : null,
          failedAt: status === "FAILED" ? plus(sentAt, 10 * MINUTE) : null,
          createdAt,
        });
      }
      if (chance(r, 0.06)) {
        // WhatsApp exhausted retries, then fell back to SMS.
        const waId = bid(`delivery:${id}:whatsapp`);
        deliveries.push({
          id: waId,
          notificationId: id,
          channel: "WHATSAPP",
          status: "FAILED",
          attempts: 3,
          lastError: "Recipient not on WhatsApp",
          queuedAt: createdAt,
          sentAt,
          failedAt: plus(sentAt, 15 * MINUTE),
          createdAt,
        });
        deliveries.push({
          id: bid(`delivery:${id}:sms`),
          notificationId: id,
          channel: "SMS",
          status: "DELIVERED",
          attempts: 1,
          fallbackFromId: waId,
          providerMessageId: `bulk-sms-${hex(`sms:${id}`).slice(0, 12)}`,
          queuedAt: plus(sentAt, 15 * MINUTE),
          sentAt: plus(sentAt, 16 * MINUTE),
          deliveredAt: plus(sentAt, 17 * MINUTE),
          createdAt,
        });
      } else if (chance(r, 0.08)) {
        deliveries.push({
          id: bid(`delivery:${id}:web-push`),
          notificationId: id,
          channel: "WEB_PUSH",
          status: "SENT",
          attempts: 1,
          webPushSubscription: {
            endpoint: `https://push.example.invalid/${hex(`push:${rec.key}`).slice(0, 20)}`,
            keys: { p256dh: "bulk-seed", auth: "bulk-seed" },
          },
          queuedAt: createdAt,
          sentAt,
          createdAt,
        });
      }
    }

    if (rec.prefs && chance(r, 0.4)) {
      const dnd = chance(r, 0.4);
      preferences.push({
        id: bid(`notification-preference:${rec.key}`),
        userId: rec.id,
        emailEnabled: chance(r, 0.85),
        smsEnabled: chance(r, 0.6),
        whatsappEnabled: chance(r, 0.5),
        webPushEnabled: chance(r, 0.7),
        inAppEnabled: true,
        mutedCategories: sample(
          r,
          ["community", "recommendations", "cms", "learning"],
          weighted(r, [
            [0, 60],
            [1, 30],
            [2, 10],
          ] as const),
        ),
        dndStartMinute: dnd ? 22 * 60 : null,
        dndEndMinute: dnd ? 7 * 60 : null,
        digestMode: weighted(r, [
          ["INSTANT", 70],
          ["DAILY", 20],
          ["WEEKLY", 10],
        ] as const),
        language: chance(r, 0.15) ? "hi" : "en",
        timezone: chance(r, 0.9) ? "Asia/Kolkata" : "UTC",
      });
    }
  }

  await insert("notifications", notifications, (data) =>
    prisma.notification.createMany({ data, skipDuplicates: true }),
  );
  // Fallback deliveries reference another delivery, so insert originals first.
  await insert(
    "notification deliveries",
    deliveries.filter((d) => !d.fallbackFromId),
    (data) => prisma.notificationDelivery.createMany({ data, skipDuplicates: true }),
  );
  await insert(
    "notification deliveries",
    deliveries.filter((d) => d.fallbackFromId),
    (data) => prisma.notificationDelivery.createMany({ data, skipDuplicates: true }),
  );
  await insert("notification preferences", preferences, (data) =>
    prisma.notificationPreference.createMany({ data, skipDuplicates: true }),
  );
}

// ---------------------------------------------------------------------------
// 10. CMS, scheduled reports, audit log
// ---------------------------------------------------------------------------

async function seedCmsReportsAudit(ctx: Ctx): Promise<void> {
  const author = ctx.admins[0]!.id;
  const editor = (ctx.admins[1] ?? ctx.admins[0]!).id;
  const versions: Prisma.CmsContentVersionCreateManyInput[] = [];
  type Workflow = "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED" | "ARCHIVED";
  const trail: Record<Workflow, Workflow[]> = {
    DRAFT: ["DRAFT"],
    IN_REVIEW: ["DRAFT", "IN_REVIEW"],
    APPROVED: ["DRAFT", "IN_REVIEW", "APPROVED"],
    PUBLISHED: ["DRAFT", "IN_REVIEW", "APPROVED", "PUBLISHED"],
    ARCHIVED: ["DRAFT", "IN_REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"],
  };
  const addVersions = (
    contentType: "PAGE" | "FAQ" | "ANNOUNCEMENT" | "BANNER",
    contentId: string,
    status: Workflow,
    snapshot: Record<string, unknown>,
    start: Date,
  ): number => {
    const steps = trail[status];
    steps.forEach((s, i) => {
      versions.push({
        id: bid(`cms-version:${contentId}:${i + 1}`),
        contentType,
        contentId,
        versionNumber: i + 1,
        snapshot: { ...snapshot, status: s },
        status: s,
        changeNote: i === 0 ? "Created" : `Moved to ${s.toLowerCase().replace("_", " ")}`,
        createdById: i % 2 === 0 ? author : editor,
        createdAt: plus(start, i * DAY),
      });
    });
    return steps.length;
  };

  const pageDefs: {
    slug: string;
    pageType: "LANDING" | "STATIC";
    title: string;
    status: Workflow;
    schedule?: "publish" | "unpublish";
  }[] = [
    {
      slug: "bulk-nift-2027-landing",
      pageType: "LANDING",
      title: "Crack NIFT 2027 with Examora",
      status: "PUBLISHED",
    },
    {
      slug: "bulk-ceed-crash-course",
      pageType: "LANDING",
      title: "CEED Crash Course — Enrol Now",
      status: "IN_REVIEW",
    },
    {
      slug: "bulk-refund-policy",
      pageType: "STATIC",
      title: "Refund Policy",
      status: "PUBLISHED",
      schedule: "unpublish",
    },
    {
      slug: "bulk-scholarships",
      pageType: "STATIC",
      title: "Scholarships 2027",
      status: "APPROVED",
      schedule: "publish",
    },
    { slug: "bulk-careers", pageType: "STATIC", title: "Careers at Examora", status: "DRAFT" },
    {
      slug: "bulk-diwali-offer-2025",
      pageType: "LANDING",
      title: "Diwali Offer 2025",
      status: "ARCHIVED",
    },
  ];
  const pages: Prisma.CmsPageCreateManyInput[] = pageDefs.map((p, i) => {
    const id = bid(`cms-page:${p.slug}`);
    const start = daysAgo(90 - i * 10);
    const body = `# ${p.title}\n\nThis page was generated by the bulk seed for testing the CMS workflow.`;
    const version = addVersions(
      "PAGE",
      id,
      p.status,
      { title: p.title, body, slug: p.slug },
      start,
    );
    return {
      id,
      pageType: p.pageType,
      slug: p.slug,
      title: p.title,
      body,
      seoTitle: `${p.title} | Examora`,
      seoDescription: chance(rng(p.slug), 0.7)
        ? `Learn more about ${p.title.toLowerCase()}.`
        : null,
      status: p.status,
      version,
      scheduledPublishAt: p.schedule === "publish" ? daysAhead(5) : null,
      scheduledUnpublishAt: p.schedule === "unpublish" ? daysAhead(30) : null,
      publishedAt:
        p.status === "PUBLISHED" || p.status === "ARCHIVED" ? plus(start, 3 * DAY) : null,
      createdById: author,
      updatedById: version > 1 ? editor : null,
      createdAt: start,
    };
  });

  const faqDefs: [string, string, string][] = [
    [
      "Payments",
      "Which payment methods are supported?",
      "UPI, cards and net banking via Razorpay.",
    ],
    [
      "Payments",
      "Can I get a refund?",
      "Refunds can be requested from the Orders page and are reviewed within 3 working days.",
    ],
    ["Payments", "Do coupons stack?", "No — one coupon per order."],
    [
      "Courses",
      "How long do I have access to a course?",
      "Most courses give lifetime access; some have a 12-month validity shown at checkout.",
    ],
    ["Courses", "Can I download lessons?", "PDF lessons can be downloaded; videos stream only."],
    ["Courses", "Are free courses really free?", "Yes, no card required."],
    [
      "Assignments",
      "What file types can I upload?",
      "Each assignment lists its allowed types — usually PDF, PNG and JPEG.",
    ],
    [
      "Assignments",
      "What happens if I miss a deadline?",
      "Late submissions are accepted but flagged to your reviewer.",
    ],
    [
      "Assignments",
      "How do revisions work?",
      "If a reviewer requests changes you can submit a new version from the same page.",
    ],
    ["Account", "How do I reset my password?", "Use 'Forgot password' on the login page."],
    [
      "Account",
      "Can my parent see my progress?",
      "Yes, if you add a guardian email and grant guardian consent.",
    ],
    [
      "Mentoring",
      "How are mentors assigned?",
      "An admin assigns a mentor based on your target exam.",
    ],
    ["Mentoring", "Can I change my mentor?", "Ask support; your history is kept."],
    ["Mentoring", "How often are sessions?", "Typically fortnightly, scheduled by your mentor."],
    ["Account", "Old question about legacy app login", "No longer applicable."],
  ];
  const faqs: Prisma.CmsFaqItemCreateManyInput[] = faqDefs.map(
    ([category, question, answer], i) => {
      const id = bid(`cms-faq:${i}`);
      const status: Workflow =
        i === 14 ? "ARCHIVED" : i === 5 ? "DRAFT" : i === 12 ? "IN_REVIEW" : "PUBLISHED";
      const start = daysAgo(120 - i * 3);
      const version = addVersions("FAQ", id, status, { question, answer, category }, start);
      return {
        id,
        question,
        answer,
        category,
        position: 100 + i,
        status,
        version,
        publishedAt: status === "PUBLISHED" || status === "ARCHIVED" ? plus(start, 3 * DAY) : null,
        createdById: author,
        updatedById: version > 1 ? editor : null,
        createdAt: start,
      };
    },
  );

  const announcementDefs: [string, Workflow, "publish" | "unpublish" | null][] = [
    ["Mock exam schedule for next month is live", "PUBLISHED", null],
    ["New course: Advanced Portfolio Prep", "PUBLISHED", "unpublish"],
    ["Scheduled maintenance this Sunday 2–4 AM IST", "APPROVED", "publish"],
    ["Mentor office hours are moving to Fridays", "IN_REVIEW", null],
    ["Draft: Results announcement template", "DRAFT", null],
    ["Summer workshop registrations closed", "ARCHIVED", null],
  ];
  const announcements: Prisma.CmsAnnouncementCreateManyInput[] = announcementDefs.map(
    ([title, status, schedule], i) => {
      const id = bid(`cms-announcement:${i}`);
      const start = daysAgo(60 - i * 8);
      const body = `${title}. Generated by the bulk seed.`;
      const version = addVersions("ANNOUNCEMENT", id, status, { title, body }, start);
      return {
        id,
        title,
        body,
        status,
        version,
        scheduledPublishAt: schedule === "publish" ? daysAhead(3) : null,
        scheduledUnpublishAt: schedule === "unpublish" ? daysAhead(14) : null,
        publishedAt: status === "PUBLISHED" || status === "ARCHIVED" ? plus(start, 3 * DAY) : null,
        createdById: author,
        updatedById: version > 1 ? editor : null,
        createdAt: start,
      };
    },
  );

  const bannerDefs: [string, string, Workflow][] = [
    ["Get 25% off with BULK25", "HOMEPAGE_TOP", "PUBLISHED"],
    ["NIFT 2027 batch now open", "HOMEPAGE_TOP", "PUBLISHED"],
    ["Join a study group", "DASHBOARD_TOP", "PUBLISHED"],
    ["Festive sale (upcoming)", "HOMEPAGE_TOP", "APPROVED"],
    ["Old monsoon sale", "HOMEPAGE_TOP", "ARCHIVED"],
  ];
  const banners: Prisma.CmsBannerCreateManyInput[] = bannerDefs.map(
    ([title, placement, status], i) => {
      const id = bid(`cms-banner:${i}`);
      const start = daysAgo(45 - i * 5);
      const version = addVersions("BANNER", id, status, { title, placement }, start);
      return {
        id,
        title,
        placement,
        linkUrl: "/courses",
        position: 10 + i,
        status,
        version,
        scheduledPublishAt: status === "APPROVED" ? daysAhead(7) : null,
        publishedAt: status === "PUBLISHED" || status === "ARCHIVED" ? plus(start, 3 * DAY) : null,
        createdById: author,
        updatedById: version > 1 ? editor : null,
        createdAt: start,
      };
    },
  );

  await insert("cms pages", pages, (data) =>
    prisma.cmsPage.createMany({ data, skipDuplicates: true }),
  );
  await insert("cms faq items", faqs, (data) =>
    prisma.cmsFaqItem.createMany({ data, skipDuplicates: true }),
  );
  await insert("cms announcements", announcements, (data) =>
    prisma.cmsAnnouncement.createMany({ data, skipDuplicates: true }),
  );
  await insert("cms banners", banners, (data) =>
    prisma.cmsBanner.createMany({ data, skipDuplicates: true }),
  );
  await insert("cms content versions", versions, (data) =>
    prisma.cmsContentVersion.createMany({ data, skipDuplicates: true }),
  );

  const reports: Prisma.ScheduledReportCreateManyInput[] = [
    {
      name: "Weekly revenue",
      reportType: "REVENUE",
      cadence: "WEEKLY",
      format: "CSV",
      isActive: true,
    },
    {
      name: "Daily enrollments",
      reportType: "ENROLLMENT",
      cadence: "DAILY",
      format: "CSV",
      isActive: true,
    },
    {
      name: "Monthly assignment performance",
      reportType: "ASSIGNMENT_PERFORMANCE",
      cadence: "MONTHLY",
      format: "PDF",
      isActive: true,
    },
    {
      name: "Mentor performance (paused)",
      reportType: "MENTOR_PERFORMANCE",
      cadence: "WEEKLY",
      format: "CSV",
      isActive: false,
    },
    {
      name: "Notification delivery health",
      reportType: "NOTIFICATION_DELIVERY",
      cadence: "DAILY",
      format: "CSV",
      isActive: true,
    },
  ].map((rep, i) => ({
    ...(rep as Omit<Prisma.ScheduledReportCreateManyInput, "createdById">),
    id: bid(`scheduled-report:${i}`),
    createdById: author,
    filters: { rangeDays: 30 },
    lastRunAt: rep.isActive ? daysAgo(1) : daysAgo(20),
    nextRunAt: rep.isActive
      ? daysAhead(rep.cadence === "DAILY" ? 1 : rep.cadence === "WEEKLY" ? 6 : 25)
      : null,
    createdAt: daysAgo(100),
  }));
  await insert("scheduled reports", reports, (data) =>
    prisma.scheduledReport.createMany({ data, skipDuplicates: true }),
  );

  const actions: [string, string][] = [
    ["auth.login_failed", "User"],
    ["profile.updated", "User"],
    ["mentoring.mentor_assigned", "MentorAssignment"],
    ["mentoring.task_created", "MentorTask"],
    ["mentoring.note_created", "MentorNote"],
    ["enrollment.admin_granted", "Enrollment"],
    ["enrollment.admin_revoked", "Enrollment"],
    ["community.thread_hidden", "Thread"],
    ["community.reply_hidden", "Reply"],
    ["notifications.broadcast_sent", "Notification"],
    ["content.topic_updated", "Topic"],
    ["assignments.file_infected", "SubmissionFile"],
    ["learning.lesson_completed", "Lesson"],
  ];
  const actors = [
    ctx.demo.adminId,
    ...ctx.admins.map((a) => a.id),
    ...ctx.mentors.map((m) => m.id),
    null,
  ];
  const audit: Prisma.AuditLogCreateManyInput[] = Array.from(
    { length: Math.max(150, ctx.students.length * 1.5) },
    (_, i) => {
      const r = rng(`audit:${i}`);
      const [action, entityType] = pick(r, actions);
      return {
        id: bid(`audit:${i}`),
        actorId: action === "auth.login_failed" ? null : pick(r, actors),
        action,
        entityType,
        entityId: bid(`audit-entity:${i}`),
        afterState: { source: "bulk-seed" },
        ipAddress: `10.0.${int(r, 0, 255)}.${int(r, 1, 254)}`,
        correlationId: AUDIT_CORRELATION_ID,
        createdAt: daysAgo(r() * 90),
      };
    },
  );
  await insert("audit logs", audit, (data) =>
    prisma.auditLog.createMany({ data, skipDuplicates: true }),
  );
}

// ---------------------------------------------------------------------------
// Clean-up: removes exactly what this script creates.
// ---------------------------------------------------------------------------

async function clean(): Promise<void> {
  log("Removing bulk test data...");
  const steps: [string, () => Promise<{ count: number }>][] = [
    [
      "notifications",
      () =>
        prisma.notification.deleteMany({ where: { data: { path: ["bulkSeed"], equals: true } } }),
    ],
    [
      "audit logs",
      () => prisma.auditLog.deleteMany({ where: { correlationId: AUDIT_CORRELATION_ID } }),
    ],
    // Cascades to roles, consent, enrollments, orders/payments/invoices/refunds,
    // progress, attempts, submissions/files/reviews/comments, mentoring rows,
    // threads/replies/likes, CMS content and scheduled reports they created.
    [
      "users",
      () =>
        prisma.user.deleteMany({
          where: {
            OR: [
              { email: { endsWith: `@${BULK_DOMAIN}` } },
              { email: { in: [REVIEWER_LOGIN, GUARDIAN_LOGIN] } },
            ],
          },
        }),
    ],
    [
      "assignments",
      () => prisma.assignment.deleteMany({ where: { slug: { startsWith: "bulk-" } } }),
    ],
    [
      "assignment templates",
      () =>
        prisma.assignmentTemplate.deleteMany({
          where: { id: { in: ASSIGNMENT_SPECS.map((s) => bid(`template:${s.key}`)) } },
        }),
    ],
    ["quizzes", () => prisma.quiz.deleteMany({ where: { slug: { startsWith: "bulk-" } } })],
    ["questions", () => prisma.question.deleteMany({ where: { tags: { has: "bulk-seed" } } })],
    ["coupons", () => prisma.coupon.deleteMany({ where: { code: { startsWith: "BULK" } } })],
    [
      "forum categories",
      () => prisma.forumCategory.deleteMany({ where: { slug: { startsWith: "bulk-" } } }),
    ],
    ["courses", () => prisma.course.deleteMany({ where: { slug: { startsWith: "bulk-" } } })],
  ];
  for (const [name, run] of steps) {
    const { count } = await run();
    log(`  ${name.padEnd(22)} ${count}`);
  }
  log("Done. The regular demo data from seed.ts is untouched.");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function parseScale(): Scale {
  const arg = process.argv.find((a) => a.startsWith("--scale="))?.split("=")[1];
  const value = (arg ?? process.env.SEED_SCALE ?? "medium").toLowerCase();
  if (value !== "small" && value !== "medium" && value !== "large") {
    throw new Error(`Unknown scale "${value}" — use small, medium or large.`);
  }
  return value;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run the bulk test-data seed with NODE_ENV=production.");
  }
  if (process.argv.includes("--clean")) {
    await clean();
    return;
  }

  const scale = parseScale();
  const started = Date.now();

  const demoUsers = await prisma.user.findMany({
    where: { email: { in: ["admin@examora.test", "mentor@examora.test", "student@examora.test"] } },
  });
  const byEmail = new Map(demoUsers.map((u) => [u.email, u.id]));
  if (byEmail.size < 3) {
    throw new Error(
      "Demo accounts not found — run `pnpm db:seed` (or `pnpm db:migrate`) before the bulk seed.",
    );
  }
  const demo: DemoIds = {
    adminId: byEmail.get("admin@examora.test")!,
    mentorId: byEmail.get("mentor@examora.test")!,
    studentId: byEmail.get("student@examora.test")!,
  };

  log(`Seeding bulk test data (scale: ${scale})...`);
  const users = await seedUsers(scale, demo);
  await seedEdgeCaseCourses(users.admins[0]!.id);
  const catalog = await loadCatalog();
  const ctx: Ctx = { ...users, ...catalog, enrollments: new Map() };

  log("  users ✓  → commerce & enrollments");
  await seedCommerce(ctx);
  log("  commerce ✓  → lesson progress");
  await seedLessonProgress(ctx);
  log("  progress ✓  → quizzes & attempts");
  await seedQuizContent(ctx);
  await seedQuizAttempts(ctx);
  log("  quizzes ✓  → assignments & submissions");
  await seedAssignmentContent(ctx);
  await seedSubmissions(ctx);
  log("  assignments ✓  → mentoring");
  await seedMentoring(ctx);
  log("  mentoring ✓  → community");
  await seedCommunity(ctx);
  log("  community ✓  → notifications");
  await seedNotifications(ctx);
  log("  notifications ✓  → CMS, reports, audit log");
  await seedCmsReportsAudit(ctx);

  log("\nRows inserted this run (0 = already present from a previous run):");
  for (const [name, count] of tally) log(`  ${name.padEnd(26)} ${count}`);
  const password = process.env.DEV_SEED_PASSWORD ? "DEV_SEED_PASSWORD" : "a-strong-password-123";
  log(
    `\nExtra logins (password: ${password}):\n` +
      `  ${REVIEWER_LOGIN}  — reviewer with a populated review queue\n` +
      `  ${GUARDIAN_LOGIN}  — guardian of student0001 and student0002\n` +
      `  student0001@${BULK_DOMAIN} … admin01@${BULK_DOMAIN}, mentor001@…, reviewer01@…, guardian001@…\n` +
      `Finished in ${((Date.now() - started) / 1000).toFixed(1)}s. Remove it all with: pnpm db:seed:bulk:clean`,
  );
}

main()
  .catch((error: unknown) => {
    console.error("Bulk seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
