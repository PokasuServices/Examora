/**
 * Sample course content for the student module redesign: an "NID UG | UCEED"
 * design-entrance course written for Examora. All lesson text and questions
 * here are original sample material for testing, and the past-paper numbers
 * are invented for the heatmap; none of it is real exam data.
 */

export interface SampleQuestion {
  text: string;
  options: string[];
  /** Index into options. */
  correct: number;
  explanation?: string;
}

export interface SampleQuiz {
  key: string;
  title: string;
  level: "EASY" | "MEDIUM" | "HARD";
  maxAttempts: number | null;
  xpReward: number;
  questions: SampleQuestion[];
}

export interface SampleLesson {
  key: string;
  title: string;
  body: string;
}

export interface SampleTopic {
  key: string;
  title: string;
  description?: string;
  /** Omitted → one generated "Introduction" lesson. */
  lessons?: SampleLesson[];
  quizzes?: SampleQuiz[];
}

export interface SampleSubject {
  key: string;
  title: string;
  description: string;
  kind: "SUBJECT" | "ESSENTIALS";
  icon: string;
  color: string;
  topics: SampleTopic[];
}

export const SAMPLE_COURSE = {
  key: "nid-ug-uceed",
  title: "NID UG | UCEED",
  slug: "nid-ug-uceed",
  examType: "NID / UCEED",
  description:
    "Preparation for undergraduate design entrance exams: aptitude, visual and spatial ability, general knowledge and design sketching.",
  nextExamDate: "2027-01-17T09:00:00.000Z",
};

export function introLesson(topicTitle: string): SampleLesson {
  return {
    key: "intro",
    title: `Introduction to ${topicTitle}`,
    body: `# ${topicTitle}

This topic appears regularly in design entrance aptitude papers. Questions are short, so speed and accuracy both matter.

## What you will practise

- Recognising the question type within a few seconds
- A reliable step-by-step method instead of guessing
- Spotting the traps that make an attractive option wrong

## Tips

1. Read the whole question before looking at the options.
2. Write down what is given; a small sketch often makes the answer obvious.
3. If you can't decide between two options, eliminate the others first and note that you used elimination.`,
  };
}

const PUZZLE_LESSONS: SampleLesson[] = [
  {
    key: "examples",
    title: "Examples - past paper style",
    body: `# Worked examples

These are written in the style of entrance-exam puzzle questions.

**Example 1.** A shop is open on alternate days starting Monday. Is it open on the following Sunday?

Monday (open), Tuesday (closed), Wednesday (open) … every other day, so it is open on Monday, Wednesday, Friday and Sunday. **Yes.**

**Example 2.** Five friends stand in a line. Asha is ahead of Ben but behind Chirag. Dev is last. Esha is first. Who is in the middle?

Order: Esha, Chirag, Asha, Ben, Dev. The middle (third) person is **Asha**.`,
  },
  {
    key: "basics",
    title: "Basic concepts",
    body: `# Approaching a puzzle

1. **List the facts.** Turn each sentence into a short note: \`A > B\`, \`C is not first\`.
2. **Fix what is certain first.** Absolute positions ("Dev is last") come before relative ones.
3. **Use a grid** when there are two attributes (person × colour, person × day).
4. **Check every condition** against your final arrangement before choosing an option.`,
  },
  {
    key: "clock",
    title: "Clock puzzles",
    body: `# Clock puzzles

The angle between the hands at **H** hours and **M** minutes is

\`θ = |30H − 5.5M|\` (subtract from 360° if it is more than 180°).

- The minute hand moves 6° per minute; the hour hand moves 0.5° per minute.
- The hands overlap **11 times** in 12 hours, not 12.
- Mirror image of a time: subtract it from **11:60** (e.g. 4:20 → 7:40).`,
  },
  {
    key: "logic",
    title: "Logic puzzles",
    body: `# Logic puzzles

Build a table with one row per person and one column per attribute. Fill **✓** for facts and **✗** for impossibilities. When a row has only one empty cell left, that cell must be **✓**.`,
  },
  {
    key: "number",
    title: "Number puzzles",
    body: `# Number puzzles

Try these patterns in order:

1. Differences between terms (constant, increasing by a fixed amount)
2. Ratios (×2, ×3)
3. Squares and cubes (1, 4, 9, 16 … / 1, 8, 27 …)
4. Two interleaved series (odd and even positions)`,
  },
];

const CLOCK_QUIZ: SampleQuiz = {
  key: "clock-puzzles",
  title: "Clock Puzzles",
  level: "EASY",
  maxAttempts: 5,
  xpReward: 20,
  questions: [
    {
      text: "What is the angle between the hands of a clock at 3:00?",
      options: ["90°", "60°", "120°", "180°"],
      correct: 0,
    },
    {
      text: "How many times do the hands of a clock overlap in 12 hours?",
      options: ["12", "11", "10", "24"],
      correct: 1,
      explanation: "They overlap every 12/11 hours, so 11 times.",
    },
    {
      text: "What is the angle between the hands at 2:30?",
      options: ["90°", "120°", "105°", "75°"],
      correct: 2,
      explanation: "|30×2 − 5.5×30| = |60 − 165| = 105°.",
    },
    {
      text: "A clock gains 5 minutes every hour. It is set right at noon. What does it show at 6 pm?",
      options: ["6:25", "6:30", "6:05", "5:30"],
      correct: 1,
    },
    {
      text: "A clock shows 4:20. What time does its mirror image show?",
      options: ["8:40", "7:20", "7:40", "8:20"],
      correct: 2,
      explanation: "11:60 − 4:20 = 7:40.",
    },
  ],
};

const NUMBER_QUIZ: SampleQuiz = {
  key: "number-puzzles",
  title: "Number Puzzles",
  level: "EASY",
  maxAttempts: 5,
  xpReward: 30,
  questions: [
    {
      text: "Find the next number: 2, 6, 12, 20, 30, ?",
      options: ["40", "42", "44", "36"],
      correct: 1,
      explanation: "Differences are 4, 6, 8, 10, 12.",
    },
    {
      text: "Find the missing number: 3, 9, 27, ?, 243",
      options: ["54", "72", "81", "90"],
      correct: 2,
    },
    {
      text: "If 5 + 3 = 28 and 9 + 1 = 810, then 8 + 6 = ?",
      options: ["214", "48", "1214", "142"],
      correct: 0,
      explanation: "Write (a − b) then (a + b): 8 − 6 = 2, 8 + 6 = 14.",
    },
    {
      text: "What is the sum of the first 10 odd numbers?",
      options: ["90", "100", "110", "55"],
      correct: 1,
    },
    {
      text: "Which number is the odd one out? 121, 144, 169, 196, 250",
      options: ["144", "169", "196", "250"],
      correct: 3,
      explanation: "All others are perfect squares.",
    },
  ],
};

const PUZZLE_REVIEW_QUIZ: SampleQuiz = {
  key: "puzzles-review",
  title: "Puzzles Review",
  level: "MEDIUM",
  maxAttempts: 5,
  xpReward: 20,
  questions: [
    {
      text: "Esha is first, Dev is last, Asha is ahead of Ben but behind Chirag. Who is fourth?",
      options: ["Asha", "Ben", "Chirag", "Dev"],
      correct: 1,
    },
    {
      text: "A shop opens on alternate days starting Monday. Which day is it closed?",
      options: ["Wednesday", "Friday", "Saturday", "Sunday"],
      correct: 2,
    },
    {
      text: "Which comes next: A, C, F, J, ?",
      options: ["N", "O", "M", "P"],
      correct: 1,
      explanation: "Gaps of 2, 3, 4, 5.",
    },
    {
      text: "How many squares are on a standard chessboard (all sizes)?",
      options: ["64", "204", "100", "144"],
      correct: 1,
    },
  ],
};

const BLOOD_QUIZ: SampleQuiz = {
  key: "blood-relations-quiz",
  title: "Blood Relations Practice",
  level: "EASY",
  maxAttempts: 5,
  xpReward: 20,
  questions: [
    {
      text: "A is B's brother and B is C's mother. How is A related to C?",
      options: ["Father", "Uncle", "Brother", "Grandfather"],
      correct: 1,
    },
    {
      text: 'Pointing to a man, Riya says, "His mother is the only daughter of my mother." How is the man related to Riya?',
      options: ["Brother", "Nephew", "Son", "Cousin"],
      correct: 2,
    },
    {
      text: "X is the father of Y, and Y is the sister of Z. How is X related to Z?",
      options: ["Father", "Uncle", "Brother", "Grandfather"],
      correct: 0,
    },
    {
      text: "P is the husband of Q, and R is the son of Q. How is P related to R?",
      options: ["Uncle", "Brother", "Father", "Cousin"],
      correct: 2,
    },
  ],
};

const AV_QUIZ: SampleQuiz = {
  key: "av-terminology-quiz",
  title: "Audio & Video Terminology Quiz",
  level: "MEDIUM",
  maxAttempts: 5,
  xpReward: 20,
  questions: [
    {
      text: "As the wavelength of a sound wave increases, its frequency…",
      options: ["Increases", "Decreases", "Stays the same", "Becomes zero"],
      correct: 1,
    },
    {
      text: "What is the SI unit of frequency?",
      options: ["Ohm", "Hertz", "Decibel", "Watt"],
      correct: 1,
    },
    {
      text: "Sound pressure level is usually measured in…",
      options: ["Hertz", "Decibels", "Lumens", "Volts"],
      correct: 1,
    },
    {
      text: 'In "1080p", the number 1080 refers to…',
      options: [
        "Frames per second",
        "Horizontal pixels",
        "Vertical lines of resolution",
        "Bitrate in kbps",
      ],
      correct: 2,
    },
    {
      text: "Frame rate is measured in…",
      options: ["fps", "dpi", "kbps", "Hz only for audio"],
      correct: 0,
    },
    {
      text: "Which of these audio formats is lossless?",
      options: ["MP3", "AAC", "FLAC", "OGG Vorbis"],
      correct: 2,
    },
    {
      text: "What is the aspect ratio of standard HD video?",
      options: ["4:3", "16:9", "1:1", "21:9"],
      correct: 1,
    },
    {
      text: "Which microphone pattern picks up sound mainly from the front?",
      options: ["Omnidirectional", "Cardioid", "Figure-8", "Boundary"],
      correct: 1,
    },
    {
      text: "In digital audio, bit depth determines…",
      options: [
        "The number of channels",
        "The precision (dynamic range) of each sample",
        "The file name length",
        "The playback speed",
      ],
      correct: 1,
    },
    {
      text: 'The word "codec" is short for…',
      options: [
        "Code-decode / coder-decoder",
        "Colour decoder",
        "Compressed decibel",
        "Content decoder",
      ],
      correct: 0,
    },
  ],
};

const AV_LESSONS: SampleLesson[] = [
  {
    key: "audio",
    title: "Audio Terminology",
    body: `# Audio terminology

- **Amplitude** — the size of a sound wave; we hear it as loudness.
- **Frequency** — vibrations per second, measured in **hertz (Hz)**; we hear it as pitch. Longer wavelengths mean lower frequencies.
- **Decibel (dB)** — a logarithmic unit for sound level. +10 dB is roughly perceived as twice as loud.
- **Sample rate** — how many times per second audio is measured when digitised (44.1 kHz for CDs).
- **Bit depth** — how precisely each sample is stored; more bits give more dynamic range.
- **Mono / stereo** — one channel versus two.
- **Polar pattern** — the directions a microphone hears from: omnidirectional, cardioid (front), figure-8 (front and back).`,
  },
  {
    key: "video",
    title: "Video Terminology",
    body: `# Video terminology

- **Resolution** — pixel dimensions, e.g. 1920 × 1080 ("1080p" counts the vertical lines).
- **Frame rate** — frames per second (fps): 24 for cinema, 25/30 for broadcast, 60 for smooth motion.
- **Aspect ratio** — width : height. HD and 4K use **16:9**.
- **Bitrate** — data per second; higher bitrate usually means better quality and bigger files.
- **Progressive (p) vs interlaced (i)** — full frames versus alternating half-frames.`,
  },
  {
    key: "formats",
    title: "Common formats and codecs",
    body: `# Formats and codecs

A **container** (MP4, MOV, MKV, WAV) holds streams; a **codec** (H.264, HEVC, AAC, FLAC) compresses them.

- **Lossless audio:** WAV, FLAC, ALAC
- **Lossy audio:** MP3, AAC, OGG
- **Video codecs:** H.264, HEVC (H.265), AV1

*Codec* is short for **coder-decoder**.`,
  },
];

const BLOOD_LESSONS: SampleLesson[] = [
  {
    key: "family-tree",
    title: "Family tree basics",
    body: `# Drawing a family tree

Use **+** for male and **−** for female, a horizontal line for siblings, a vertical line for parent → child and a double line for a married couple.

Always start from the person the question is about and walk one relation at a time.`,
  },
  {
    key: "coded",
    title: "Pointing and coded relations",
    body: `# "Pointing to a man…" questions

Rewrite the sentence from the speaker's side: "the only daughter of my mother" is the speaker herself. Replace phrases like this one by one until a single relation remains.`,
  },
];

const t = (key: string, title: string, extra: Partial<SampleTopic> = {}): SampleTopic => ({
  key,
  title,
  ...extra,
});

export const SAMPLE_SUBJECTS: SampleSubject[] = [
  {
    key: "mental-ability",
    title: "Mental Ability",
    description: "Includes concepts based on logical reasoning.",
    kind: "SUBJECT",
    icon: "brain",
    color: "slate",
    topics: [
      t("blood-relations", "Blood Relations", { lessons: BLOOD_LESSONS, quizzes: [BLOOD_QUIZ] }),
      t("coding-decoding", "Coding & Decoding"),
      t("direction-sense", "Distance & Direction Sense"),
      t("puzzles", "Puzzles", {
        lessons: PUZZLE_LESSONS,
        quizzes: [CLOCK_QUIZ, NUMBER_QUIZ, PUZZLE_REVIEW_QUIZ],
      }),
      t("seating", "Seating Arrangements"),
      t("analogies", "Analogies"),
      t("series-completion", "Completion of Series"),
      t("paper-folding", "Paper Folding & Cutting"),
      t("sequences", "Series & Sequences"),
      t("odd-one-out", "Odd One Out", { description: "Verbal and non-verbal odd one out" }),
    ],
  },
  {
    key: "analytical-reasoning",
    title: "Analytical Reasoning",
    description: "Tests your ability to analyse any given statement or situation.",
    kind: "SUBJECT",
    icon: "lightbulb",
    color: "amber",
    topics: [
      t("statements", "Statements & Conclusions"),
      t("syllogisms", "Syllogisms"),
      t("data-sufficiency", "Data Sufficiency"),
    ],
  },
  {
    key: "visual-spatial",
    title: "Visual Spatial Ability",
    description: "Ability to mentally manipulate 2-dimensional and 3-dimensional figures.",
    kind: "SUBJECT",
    icon: "eye",
    color: "violet",
    topics: [
      t("rotation", "Rotation"),
      t("mirror-images", "Mirror Images"),
      t("hidden-figures", "Hidden Figures"),
      t("cubes-dice", "Cubes & Dice"),
    ],
  },
  {
    key: "general-knowledge",
    title: "General Knowledge",
    description: "Study of art, artists, designers, photography and culture.",
    kind: "SUBJECT",
    icon: "globe",
    color: "rose",
    topics: [
      t("av-terminology", "Audio Video Terminology", { lessons: AV_LESSONS, quizzes: [AV_QUIZ] }),
      t("famous-designers", "Famous Designers"),
      t("art-movements", "Art Movements"),
      t("indian-crafts", "Indian Crafts"),
    ],
  },
  {
    key: "mathematics",
    title: "Mathematics",
    description: "Includes mensuration, probability, statistics, permutation & combination.",
    kind: "SUBJECT",
    icon: "sigma",
    color: "pink",
    topics: [
      t("mensuration", "Mensuration"),
      t("probability", "Probability"),
      t("permutations", "Permutations & Combinations"),
    ],
  },
  {
    key: "english",
    title: "English",
    description: "Includes basic grammar, idioms & phrases, comprehension.",
    kind: "SUBJECT",
    icon: "languages",
    color: "emerald",
    topics: [t("grammar", "Grammar Basics"), t("idioms", "Idioms & Phrases")],
  },
  {
    key: "design-sketching",
    title: "Design Sketching",
    description: "Drawing exercises for perspective, human figure, interior and exterior scenes.",
    kind: "SUBJECT",
    icon: "pencil",
    color: "sky",
    topics: [
      t("perspective", "Perspective Basics"),
      t("human-figure", "Human Figure"),
      t("interiors", "Interior Scenes"),
    ],
  },
  {
    key: "exam-structure",
    title: "Exam Structure",
    description:
      "A detailed introduction to each exam's pattern, sections, weightage and syllabus.",
    kind: "ESSENTIALS",
    icon: "clipboard-list",
    color: "purple",
    topics: [t("nid-pattern", "NID B.Des Pattern"), t("uceed-pattern", "UCEED Pattern")],
  },
  {
    key: "getting-started",
    title: "Getting Started with Examora",
    description: "How Examora works and how to get the most out of your preparation.",
    kind: "ESSENTIALS",
    icon: "rocket",
    color: "indigo",
    topics: [t("using-examora", "Using Examora"), t("study-plan", "Making a Study Plan")],
  },
];

/** Invented past-paper question counts for the syllabus heatmap (sample data only). */
export const SAMPLE_PAST_PAPER_STATS: Record<string, Record<string, number[]>> = {
  // exam label → subject key → counts for YEARS
  "NID B.Des": {
    "mental-ability": [7, 2, 6, 4, 3],
    mathematics: [6, 1, 1, 0, 0],
    "analytical-reasoning": [2, 0, 0, 1, 0],
    "visual-spatial": [10, 9, 4, 1, 3],
    english: [19, 0, 0, 1, 0],
    "general-knowledge": [21, 10, 10, 12, 12],
  },
  UCEED: {
    "mental-ability": [9, 8, 10, 7, 9],
    mathematics: [4, 5, 3, 4, 6],
    "analytical-reasoning": [6, 7, 5, 8, 6],
    "visual-spatial": [14, 12, 15, 13, 16],
    english: [3, 2, 4, 2, 3],
    "general-knowledge": [8, 9, 7, 10, 8],
  },
};
export const SAMPLE_PAST_PAPER_YEARS = [2020, 2021, 2022, 2023, 2024];
