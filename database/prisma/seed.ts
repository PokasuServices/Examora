import { createHash } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  BASELINE_PERMISSION_CODES,
  MENTOR_PERMISSION_CODES,
  PERMISSION_CODES,
  REVIEWER_PERMISSION_CODES,
  type PermissionCode,
  type RoleName,
} from "@examora/types";
import * as argon2 from "argon2";
import { PrismaClient } from "../generated/client/index.js";

const prisma = new PrismaClient();

/**
 * Deterministic UUID for a stable label — lets every demo row be upserted by
 * `id` (re-running the seed never duplicates anything) even for models with
 * no natural business-key unique constraint (Question, QuizAttempt, Order,
 * etc.). Same label always produces the same id; different labels never
 * collide in practice (MD5 keyspace). Not a security boundary — this is
 * fixture data, not anything requiring unpredictability.
 */
function seedId(label: string): string {
  const hash = createHash("md5").update(`examora-demo-seed:${label}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

/**
 * Local development / demo accounts — never seeded in production, see the
 * NODE_ENV guard in main() below. Password comes from DEV_SEED_PASSWORD
 * (README "Local development demo accounts", .env.example); the literal
 * here is a documented, publicly-known local-dev default, not a real secret.
 */
interface DemoUserSeed {
  email: string;
  firstName: string;
  lastName: string;
  roles: RoleName[];
  createMentorProfile?: boolean;
}

const DEMO_USERS: DemoUserSeed[] = [
  { email: "admin@examora.test", firstName: "Demo", lastName: "Admin", roles: ["ADMINISTRATOR"] },
  {
    email: "mentor@examora.test",
    firstName: "Demo",
    lastName: "Mentor",
    roles: ["MENTOR"],
    createMentorProfile: true,
  },
  { email: "student@examora.test", firstName: "Demo", lastName: "Student", roles: ["STUDENT"] },
];

const ROLES: RoleName[] = ["STUDENT", "MENTOR", "REVIEWER", "ADMINISTRATOR", "GUARDIAN"];

/**
 * Role→permission matrix (DESIGN-03 §3). Every role gets BASELINE_PERMISSION_CODES
 * (own profile + sessions, content:read, quiz:read, assignment:read);
 * REVIEWER additionally gets REVIEWER_PERMISSION_CODES (assignment:review,
 * Sprint 5 ADR-0015); MENTOR gets MENTOR_PERMISSION_CODES (REVIEWER_PERMISSION_CODES
 * plus mentor:workflow — Student 360, notes, tasks, feedback, meetings for their
 * assigned students, Sprint 6 ADR-0016 — the first sprint where MENTOR and
 * REVIEWER diverge); ADMINISTRATOR gets everything, including Sprint 2
 * content:manage/publish (CMS-29 §7), the Sprint 3 admin progress dashboard
 * (progress:read), Sprint 4 question bank / quiz authoring / attempt
 * monitoring, Sprint 5 assignment authoring/publishing (assignment:manage,
 * assignment:publish), and Sprint 6 mentor management (mentor:manage).
 * Future modules extend this.
 */
const ROLE_PERMISSIONS: Record<RoleName, PermissionCode[]> = {
  STUDENT: BASELINE_PERMISSION_CODES,
  MENTOR: MENTOR_PERMISSION_CODES,
  REVIEWER: REVIEWER_PERMISSION_CODES,
  GUARDIAN: BASELINE_PERMISSION_CODES,
  ADMINISTRATOR: [...PERMISSION_CODES],
};

interface DemoUserIds {
  adminId: string;
  mentorId: string;
  studentId: string;
}

// ---------------------------------------------------------------------------
// Course / Learning (Category > Course > Subject > Topic > Module > Lesson).
// 14 courses across 4 categories (Fashion Design, Architecture & Interiors,
// Design & Creative Foundations, Design Entrance Exams) — a realistic mixed
// catalog for FREE/PAID discovery testing. 12 are PUBLISHED fully
// end-to-end (every level published — CatalogService's curriculum query
// filters each level to PUBLISHED, apps/api/src/learning/catalog.service.ts
// — a course whose sub-tree isn't fully published shows an empty
// curriculum even though the course itself is browsable); 2 stay DRAFT
// throughout (course-interior-design, course-advanced-portfolio-prep) to
// demonstrate unpublished admin content without leaking into the student
// catalog. `priceAmount: null` means free (Course model comment,
// schema.prisma) — EnrollmentService.assertCourseAccess gates every paid
// course on an ACTIVE Enrollment (enrollment.service.ts:29-47), so every
// paid course the student "owns" gets its Enrollment via seedCommerce()'s
// real Order/Payment/Invoice chain, not a plain enrollFree-style row.
// ---------------------------------------------------------------------------
async function seedCourseContent(ids: DemoUserIds): Promise<void> {
  const { adminId, studentId } = ids;

  const categories = [
    { key: "cat-fashion", name: "Fashion Design", slug: "demo-fashion-design" },
    {
      key: "cat-architecture",
      name: "Architecture & Interiors",
      slug: "demo-architecture-interiors",
    },
    {
      key: "cat-creative-foundations",
      name: "Design & Creative Foundations",
      slug: "demo-design-creative-foundations",
    },
    {
      key: "cat-entrance-exams",
      name: "Design Entrance Exams",
      slug: "demo-design-entrance-exams",
    },
  ];
  for (const c of categories) {
    await prisma.category.upsert({
      where: { id: seedId(c.key) },
      update: { name: c.name, slug: c.slug, isActive: true },
      create: {
        id: seedId(c.key),
        name: c.name,
        slug: c.slug,
        description: `${c.name} courses and learning paths.`,
        isActive: true,
        createdById: adminId,
      },
    });
  }

  interface LessonSpec {
    key: string;
    title: string;
    slug: string;
    contentType: "TEXT" | "VIDEO" | "ARTICLE";
    status: "PUBLISHED" | "DRAFT";
  }
  interface ModuleSpec {
    key: string;
    title: string;
    slug: string;
    status: "PUBLISHED" | "DRAFT";
    lessons: LessonSpec[];
  }
  interface TopicSpec {
    key: string;
    title: string;
    slug: string;
    status: "PUBLISHED" | "DRAFT";
    modules: ModuleSpec[];
  }
  interface SubjectSpec {
    key: string;
    title: string;
    slug: string;
    status: "PUBLISHED" | "DRAFT";
    topics: TopicSpec[];
  }
  interface CourseSpec {
    key: string;
    categoryKey: string;
    title: string;
    slug: string;
    examType: string;
    status: "PUBLISHED" | "DRAFT";
    priceAmount: string | null;
    subjects: SubjectSpec[];
  }

  const courses: CourseSpec[] = [
    {
      key: "course-fashion-foundations",
      categoryKey: "cat-fashion",
      title: "Foundations of Fashion Design",
      slug: "demo-foundations-of-fashion-design",
      examType: "NIFT",
      status: "PUBLISHED",
      priceAmount: null,
      subjects: [
        {
          key: "subject-design-fundamentals",
          title: "Design Fundamentals",
          slug: "design-fundamentals",
          status: "PUBLISHED",
          topics: [
            {
              key: "topic-elements-of-design",
              title: "Elements of Design",
              slug: "elements-of-design",
              status: "PUBLISHED",
              modules: [
                {
                  key: "module-color-and-form",
                  title: "Color & Form",
                  slug: "color-and-form",
                  status: "PUBLISHED",
                  lessons: [
                    {
                      key: "lesson-color-theory",
                      title: "Understanding Color Theory",
                      slug: "understanding-color-theory",
                      contentType: "TEXT",
                      status: "PUBLISHED",
                    },
                    {
                      key: "lesson-form-silhouette",
                      title: "Form and Silhouette",
                      slug: "form-and-silhouette",
                      contentType: "TEXT",
                      status: "PUBLISHED",
                    },
                  ],
                },
              ],
            },
            {
              key: "topic-sketching-basics",
              title: "Sketching Basics",
              slug: "sketching-basics",
              status: "PUBLISHED",
              modules: [
                {
                  key: "module-croquis-figure-drawing",
                  title: "Croquis & Figure Drawing",
                  slug: "croquis-and-figure-drawing",
                  status: "PUBLISHED",
                  lessons: [
                    {
                      key: "lesson-croquis-templates",
                      title: "Fashion Croquis Templates",
                      slug: "fashion-croquis-templates",
                      contentType: "ARTICLE",
                      status: "PUBLISHED",
                    },
                    {
                      key: "lesson-fabric-texture",
                      title: "Rendering Fabric Texture",
                      slug: "rendering-fabric-texture",
                      contentType: "VIDEO",
                      status: "PUBLISHED",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      key: "course-pattern-making",
      categoryKey: "cat-fashion",
      title: "Pattern Making Masterclass",
      slug: "demo-pattern-making-masterclass",
      examType: "NIFT",
      status: "PUBLISHED",
      priceAmount: "2999.00",
      subjects: [
        {
          key: "subject-pattern-construction",
          title: "Pattern Construction",
          slug: "pattern-construction",
          status: "PUBLISHED",
          topics: [
            {
              key: "topic-basic-blocks",
              title: "Basic Blocks",
              slug: "basic-blocks",
              status: "PUBLISHED",
              modules: [
                {
                  key: "module-bodice-block",
                  title: "Bodice Block",
                  slug: "bodice-block",
                  status: "PUBLISHED",
                  lessons: [
                    {
                      key: "lesson-drafting-bodice",
                      title: "Drafting the Bodice Block",
                      slug: "drafting-the-bodice-block",
                      contentType: "VIDEO",
                      status: "PUBLISHED",
                    },
                    {
                      key: "lesson-dart-manipulation",
                      title: "Dart Manipulation",
                      slug: "dart-manipulation",
                      contentType: "TEXT",
                      status: "PUBLISHED",
                    },
                    {
                      key: "lesson-fitting-adjustments",
                      title: "Fitting Adjustments",
                      slug: "fitting-adjustments",
                      contentType: "ARTICLE",
                      status: "PUBLISHED",
                    },
                    {
                      key: "lesson-sleeve-drafting",
                      title: "Sleeve Drafting",
                      slug: "sleeve-drafting",
                      contentType: "VIDEO",
                      status: "PUBLISHED",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      key: "course-architectural-drafting",
      categoryKey: "cat-architecture",
      title: "Architectural Drafting Basics",
      slug: "demo-architectural-drafting-basics",
      examType: "NATA",
      status: "PUBLISHED",
      priceAmount: null,
      subjects: [
        {
          key: "subject-drafting-fundamentals",
          title: "Drafting Fundamentals",
          slug: "drafting-fundamentals",
          status: "PUBLISHED",
          topics: [
            {
              key: "topic-orthographic-projections",
              title: "Orthographic Projections",
              slug: "orthographic-projections",
              status: "PUBLISHED",
              modules: [
                {
                  key: "module-plans-elevations",
                  title: "Plans & Elevations",
                  slug: "plans-and-elevations",
                  status: "PUBLISHED",
                  lessons: [
                    {
                      key: "lesson-reading-floor-plans",
                      title: "Reading Floor Plans",
                      slug: "reading-floor-plans",
                      contentType: "TEXT",
                      status: "PUBLISHED",
                    },
                    {
                      key: "lesson-elevation-drawing",
                      title: "Elevation Drawing Basics",
                      slug: "elevation-drawing-basics",
                      contentType: "VIDEO",
                      status: "PUBLISHED",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      // Deliberately left DRAFT at every level — proves unpublished content
      // management works without leaking into the student catalog, since
      // CatalogService requires the whole chain PUBLISHED (see file header).
      key: "course-interior-design",
      categoryKey: "cat-architecture",
      title: "Interior Design Principles",
      slug: "demo-interior-design-principles",
      examType: "NATA",
      status: "DRAFT",
      priceAmount: null,
      subjects: [
        {
          key: "subject-space-planning",
          title: "Space Planning",
          slug: "space-planning",
          status: "DRAFT",
          topics: [
            {
              key: "topic-layout-principles",
              title: "Layout Principles",
              slug: "layout-principles",
              status: "DRAFT",
              modules: [
                {
                  key: "module-room-zoning",
                  title: "Room Zoning",
                  slug: "room-zoning",
                  status: "DRAFT",
                  lessons: [
                    {
                      key: "lesson-intro-space-planning",
                      title: "Introduction to Space Planning",
                      slug: "introduction-to-space-planning",
                      contentType: "TEXT",
                      status: "DRAFT",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    // -------------------------------------------------------------------
    // Catalog-expansion courses (10 more, mostly minimal-but-valid published
    // hierarchies for browse/discovery/commerce testing — only the courses
    // the demo student is actually enrolled in need a deeper lesson set for
    // meaningful progress percentages; see the enrollment/progress section
    // below for exactly which ones).
    // -------------------------------------------------------------------
    {
      key: "course-nift-entrance-prep",
      categoryKey: "cat-fashion",
      title: "NIFT Entrance Preparation",
      slug: "demo-nift-entrance-preparation",
      examType: "NIFT",
      status: "PUBLISHED",
      priceAmount: "4999.00",
      subjects: [
        {
          key: "subject-nift-exam-strategy",
          title: "NIFT Exam Strategy",
          slug: "nift-exam-strategy",
          status: "PUBLISHED",
          topics: [
            {
              key: "topic-entrance-exam-overview",
              title: "Entrance Exam Overview",
              slug: "entrance-exam-overview",
              status: "PUBLISHED",
              modules: [
                {
                  key: "module-exam-pattern-syllabus",
                  title: "Exam Pattern & Syllabus",
                  slug: "exam-pattern-and-syllabus",
                  status: "PUBLISHED",
                  lessons: [
                    {
                      key: "lesson-nift-exam-pattern",
                      title: "Understanding the NIFT Exam Pattern",
                      slug: "understanding-the-nift-exam-pattern",
                      contentType: "TEXT",
                      status: "PUBLISHED",
                    },
                    {
                      key: "lesson-nift-syllabus-overview",
                      title: "NIFT Syllabus Overview",
                      slug: "nift-syllabus-overview",
                      contentType: "ARTICLE",
                      status: "PUBLISHED",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      key: "course-architecture-basics",
      categoryKey: "cat-architecture",
      title: "Architecture Basics",
      slug: "demo-architecture-basics",
      examType: "NATA",
      status: "PUBLISHED",
      priceAmount: null,
      subjects: [
        {
          key: "subject-architecture-foundations",
          title: "Architecture Foundations",
          slug: "architecture-foundations",
          status: "PUBLISHED",
          topics: [
            {
              key: "topic-intro-to-architecture",
              title: "Introduction to Architecture",
              slug: "introduction-to-architecture",
              status: "PUBLISHED",
              modules: [
                {
                  key: "module-what-architects-do",
                  title: "What Architects Do",
                  slug: "what-architects-do",
                  status: "PUBLISHED",
                  lessons: [
                    {
                      key: "lesson-role-of-an-architect",
                      title: "The Role of an Architect",
                      slug: "the-role-of-an-architect",
                      contentType: "TEXT",
                      status: "PUBLISHED",
                    },
                    {
                      key: "lesson-architecture-history-glimpse",
                      title: "A Brief History of Architecture",
                      slug: "a-brief-history-of-architecture",
                      contentType: "ARTICLE",
                      status: "PUBLISHED",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      key: "course-architecture-entrance-masterclass",
      categoryKey: "cat-architecture",
      title: "Architecture Entrance Masterclass",
      slug: "demo-architecture-entrance-masterclass",
      examType: "NATA",
      status: "PUBLISHED",
      priceAmount: "5999.00",
      subjects: [
        {
          key: "subject-nata-exam-prep",
          title: "NATA Exam Preparation",
          slug: "nata-exam-preparation",
          status: "PUBLISHED",
          topics: [
            {
              key: "topic-drawing-and-aptitude",
              title: "Drawing & Aptitude",
              slug: "drawing-and-aptitude",
              status: "PUBLISHED",
              modules: [
                {
                  key: "module-nata-drawing-practice",
                  title: "NATA Drawing Test Practice",
                  slug: "nata-drawing-test-practice",
                  status: "PUBLISHED",
                  lessons: [
                    {
                      key: "lesson-nata-drawing-test-format",
                      title: "NATA Drawing Test Format",
                      slug: "nata-drawing-test-format",
                      contentType: "TEXT",
                      status: "PUBLISHED",
                    },
                    {
                      key: "lesson-perspective-sketching-practice",
                      title: "Perspective Sketching Practice",
                      slug: "perspective-sketching-practice",
                      contentType: "VIDEO",
                      status: "PUBLISHED",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      key: "course-design-basics",
      categoryKey: "cat-creative-foundations",
      title: "Design Basics",
      slug: "demo-design-basics",
      examType: "DESIGN_APTITUDE",
      status: "PUBLISHED",
      priceAmount: null,
      subjects: [
        {
          key: "subject-intro-to-design",
          title: "Introduction to Design",
          slug: "introduction-to-design",
          status: "PUBLISHED",
          topics: [
            {
              key: "topic-design-thinking-basics",
              title: "Design Thinking Basics",
              slug: "design-thinking-basics",
              status: "PUBLISHED",
              modules: [
                {
                  key: "module-what-is-design",
                  title: "What is Design?",
                  slug: "what-is-design",
                  status: "PUBLISHED",
                  lessons: [
                    {
                      key: "lesson-what-is-design-intro",
                      title: "What is Design? An Introduction",
                      slug: "what-is-design-an-introduction",
                      contentType: "TEXT",
                      status: "PUBLISHED",
                    },
                    {
                      key: "lesson-design-thinking-process",
                      title: "The Design Thinking Process",
                      slug: "the-design-thinking-process",
                      contentType: "ARTICLE",
                      status: "PUBLISHED",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      key: "course-intro-creative-thinking",
      categoryKey: "cat-creative-foundations",
      title: "Introduction to Creative Thinking",
      slug: "demo-introduction-to-creative-thinking",
      examType: "DESIGN_APTITUDE",
      status: "PUBLISHED",
      priceAmount: null,
      subjects: [
        {
          key: "subject-creative-thinking",
          title: "Creative Thinking",
          slug: "creative-thinking",
          status: "PUBLISHED",
          topics: [
            {
              key: "topic-idea-generation",
              title: "Idea Generation",
              slug: "idea-generation",
              status: "PUBLISHED",
              modules: [
                {
                  key: "module-brainstorming-techniques",
                  title: "Brainstorming Techniques",
                  slug: "brainstorming-techniques",
                  status: "PUBLISHED",
                  lessons: [
                    {
                      key: "lesson-brainstorming-methods",
                      title: "Brainstorming Methods That Work",
                      slug: "brainstorming-methods-that-work",
                      contentType: "TEXT",
                      status: "PUBLISHED",
                    },
                    {
                      key: "lesson-mind-mapping-basics",
                      title: "Mind Mapping Basics",
                      slug: "mind-mapping-basics",
                      contentType: "ARTICLE",
                      status: "PUBLISHED",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      key: "course-drawing-fundamentals",
      categoryKey: "cat-creative-foundations",
      title: "Drawing Fundamentals",
      slug: "demo-drawing-fundamentals",
      examType: "DESIGN_APTITUDE",
      status: "PUBLISHED",
      priceAmount: null,
      subjects: [
        {
          key: "subject-drawing-basics",
          title: "Drawing Basics",
          slug: "drawing-basics",
          status: "PUBLISHED",
          topics: [
            {
              key: "topic-line-and-perspective",
              title: "Line & Perspective",
              slug: "line-and-perspective",
              status: "PUBLISHED",
              modules: [
                {
                  key: "module-perspective-drawing",
                  title: "Perspective Drawing",
                  slug: "perspective-drawing",
                  status: "PUBLISHED",
                  lessons: [
                    {
                      key: "lesson-one-point-perspective",
                      title: "One-Point Perspective",
                      slug: "one-point-perspective",
                      contentType: "VIDEO",
                      status: "PUBLISHED",
                    },
                    {
                      key: "lesson-two-point-perspective",
                      title: "Two-Point Perspective",
                      slug: "two-point-perspective",
                      contentType: "VIDEO",
                      status: "PUBLISHED",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      key: "course-design-aptitude-masterclass",
      categoryKey: "cat-creative-foundations",
      title: "Design Aptitude Masterclass",
      slug: "demo-design-aptitude-masterclass",
      examType: "DESIGN_APTITUDE",
      status: "PUBLISHED",
      priceAmount: "3499.00",
      subjects: [
        {
          key: "subject-design-aptitude-test-prep",
          title: "Design Aptitude Test Prep",
          slug: "design-aptitude-test-prep",
          status: "PUBLISHED",
          topics: [
            {
              key: "topic-aptitude-test-sections",
              title: "Aptitude Test Sections",
              slug: "aptitude-test-sections",
              status: "PUBLISHED",
              modules: [
                {
                  key: "module-observation-logical-reasoning",
                  title: "Observation & Logical Reasoning",
                  slug: "observation-and-logical-reasoning",
                  status: "PUBLISHED",
                  lessons: [
                    {
                      key: "lesson-observation-skills",
                      title: "Sharpening Observation Skills",
                      slug: "sharpening-observation-skills",
                      contentType: "TEXT",
                      status: "PUBLISHED",
                    },
                    {
                      key: "lesson-logical-reasoning-basics",
                      title: "Logical Reasoning Basics",
                      slug: "logical-reasoning-basics",
                      contentType: "ARTICLE",
                      status: "PUBLISHED",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      // A second DRAFT course (alongside course-interior-design above) —
      // admin-only "coming soon" content, deliberately unpublished at every
      // level so it never leaks into the student catalog (see file header).
      key: "course-advanced-portfolio-prep",
      categoryKey: "cat-creative-foundations",
      title: "Advanced Portfolio Preparation",
      slug: "demo-advanced-portfolio-preparation",
      examType: "DESIGN_APTITUDE",
      status: "DRAFT",
      priceAmount: "4499.00",
      subjects: [
        {
          key: "subject-advanced-portfolio",
          title: "Advanced Portfolio",
          slug: "advanced-portfolio",
          status: "DRAFT",
          topics: [
            {
              key: "topic-portfolio-planning",
              title: "Portfolio Planning",
              slug: "portfolio-planning",
              status: "DRAFT",
              modules: [
                {
                  key: "module-portfolio-curation",
                  title: "Portfolio Curation",
                  slug: "portfolio-curation",
                  status: "DRAFT",
                  lessons: [
                    {
                      key: "lesson-selecting-your-best-work",
                      title: "Selecting Your Best Work",
                      slug: "selecting-your-best-work",
                      contentType: "TEXT",
                      status: "DRAFT",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      // Five lessons deliberately — the demo student completes exactly one
      // (20% progress), the "barely started, needs work" course in the
      // performance story (see the quiz section: the weak quiz attempt is
      // seeded against this same course's subject).
      key: "course-nid-entrance-prep",
      categoryKey: "cat-entrance-exams",
      title: "NID Entrance Preparation Complete Course",
      slug: "demo-nid-entrance-preparation-complete-course",
      examType: "NID",
      status: "PUBLISHED",
      priceAmount: "6999.00",
      subjects: [
        {
          key: "subject-nid-exam-prep",
          title: "NID Exam Preparation",
          slug: "nid-exam-preparation",
          status: "PUBLISHED",
          topics: [
            {
              key: "topic-nid-test-sections",
              title: "NID Test Sections",
              slug: "nid-test-sections",
              status: "PUBLISHED",
              modules: [
                {
                  key: "module-design-aptitude-fundamentals",
                  title: "Design Aptitude Fundamentals",
                  slug: "design-aptitude-fundamentals",
                  status: "PUBLISHED",
                  lessons: [
                    {
                      key: "lesson-nid-exam-pattern",
                      title: "Understanding the NID Exam Pattern",
                      slug: "understanding-the-nid-exam-pattern",
                      contentType: "TEXT",
                      status: "PUBLISHED",
                    },
                    {
                      key: "lesson-visual-design-sensitivity",
                      title: "Visual Design Sensitivity",
                      slug: "visual-design-sensitivity",
                      contentType: "ARTICLE",
                      status: "PUBLISHED",
                    },
                    {
                      key: "lesson-materials-and-manufacturing",
                      title: "Materials & Manufacturing Awareness",
                      slug: "materials-and-manufacturing-awareness",
                      contentType: "TEXT",
                      status: "PUBLISHED",
                    },
                    {
                      key: "lesson-environmental-awareness",
                      title: "Environmental & Social Awareness",
                      slug: "environmental-and-social-awareness",
                      contentType: "ARTICLE",
                      status: "PUBLISHED",
                    },
                    {
                      key: "lesson-creative-problem-solving",
                      title: "Creative Problem Solving",
                      slug: "creative-problem-solving",
                      contentType: "VIDEO",
                      status: "PUBLISHED",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      key: "course-uceed-prep",
      categoryKey: "cat-entrance-exams",
      title: "UCEED Complete Preparation",
      slug: "demo-uceed-complete-preparation",
      examType: "UCEED",
      status: "PUBLISHED",
      priceAmount: "5499.00",
      subjects: [
        {
          key: "subject-uceed-exam-prep",
          title: "UCEED Exam Preparation",
          slug: "uceed-exam-preparation",
          status: "PUBLISHED",
          topics: [
            {
              key: "topic-uceed-test-sections",
              title: "UCEED Test Sections",
              slug: "uceed-test-sections",
              status: "PUBLISHED",
              modules: [
                {
                  key: "module-visualization-spatial-ability",
                  title: "Visualization & Spatial Ability",
                  slug: "visualization-and-spatial-ability",
                  status: "PUBLISHED",
                  lessons: [
                    {
                      key: "lesson-spatial-visualization-basics",
                      title: "Spatial Visualization Basics",
                      slug: "spatial-visualization-basics",
                      contentType: "TEXT",
                      status: "PUBLISHED",
                    },
                    {
                      key: "lesson-3d-object-perception",
                      title: "3D Object Perception",
                      slug: "3d-object-perception",
                      contentType: "VIDEO",
                      status: "PUBLISHED",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ];

  for (const course of courses) {
    const publishedAt = course.status === "PUBLISHED" ? new Date() : null;
    await prisma.course.upsert({
      where: { id: seedId(course.key) },
      update: {
        title: course.title,
        status: course.status,
        priceAmount: course.priceAmount,
        publishedAt,
      },
      create: {
        id: seedId(course.key),
        categoryId: seedId(course.categoryKey),
        title: course.title,
        slug: course.slug,
        description: `${course.title} — a demo course seeded for local development.`,
        examType: course.examType,
        status: course.status,
        publishedAt,
        priceAmount: course.priceAmount,
        createdById: adminId,
      },
    });

    for (const subject of course.subjects) {
      await prisma.subject.upsert({
        where: { id: seedId(subject.key) },
        update: { title: subject.title, status: subject.status },
        create: {
          id: seedId(subject.key),
          courseId: seedId(course.key),
          title: subject.title,
          slug: subject.slug,
          description: `${subject.title} within ${course.title}.`,
          status: subject.status,
          createdById: adminId,
        },
      });

      for (const topic of subject.topics) {
        await prisma.topic.upsert({
          where: { id: seedId(topic.key) },
          update: { title: topic.title, status: topic.status },
          create: {
            id: seedId(topic.key),
            subjectId: seedId(subject.key),
            title: topic.title,
            slug: topic.slug,
            status: topic.status,
            createdById: adminId,
          },
        });

        for (const mod of topic.modules) {
          await prisma.module.upsert({
            where: { id: seedId(mod.key) },
            update: { title: mod.title, status: mod.status },
            create: {
              id: seedId(mod.key),
              topicId: seedId(topic.key),
              title: mod.title,
              slug: mod.slug,
              status: mod.status,
              createdById: adminId,
            },
          });

          for (const lesson of mod.lessons) {
            await prisma.lesson.upsert({
              where: { id: seedId(lesson.key) },
              update: { title: lesson.title, status: lesson.status },
              create: {
                id: seedId(lesson.key),
                moduleId: seedId(mod.key),
                title: lesson.title,
                slug: lesson.slug,
                contentType: lesson.contentType,
                body:
                  lesson.contentType === "VIDEO"
                    ? null
                    : `Demo lesson content for "${lesson.title}" — seeded for local development.`,
                contentUrl: lesson.contentType === "VIDEO" ? null : null,
                durationMinutes: 10,
                status: lesson.status,
                createdById: adminId,
              },
            });
          }
        }
      }
    }
  }

  // Student enrollment + progress — a deliberately varied journey
  // (ProgressService's percentComplete = round(completedLessons/totalLessons
  // * 100), apps/api/src/learning/progress.service.ts:79) covering every
  // state the student dashboard/recommendations need to demo:
  //   - course-fashion-foundations  (FREE)   4/4 lessons -> 100%, completed
  //   - course-architectural-drafting (FREE) 1/2 lessons ->  50%, in progress
  //   - course-design-basics       (FREE)    enrolled, zero LessonProgress
  //     rows at all -> genuinely "not started" (excluded from Continue
  //     Learning/coursesStarted, same as a real never-opened enrollment)
  //   - course-pattern-making      (PAID)    3/4 lessons ->  75%, in progress
  //   - course-nid-entrance-prep   (PAID)    1/5 lessons ->  20%, in progress
  // The two paid courses' Enrollment rows are created by seedCommerce()'s
  // real Order/Payment/Invoice chain, not here, so source/orderId stay
  // correct — LessonProgress has no FK on Enrollment, so seeding it here
  // (before seedCommerce runs) is safe.
  const freeEnrollments = [
    "course-fashion-foundations",
    "course-architectural-drafting",
    "course-design-basics",
  ];
  for (const courseKey of freeEnrollments) {
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: studentId, courseId: seedId(courseKey) } },
      update: {},
      create: {
        userId: studentId,
        courseId: seedId(courseKey),
        status: "ACTIVE",
        source: "FREE",
        enrolledAt: new Date(),
      },
    });
  }

  interface ProgressSpec {
    lessonKey: string;
    courseKey: string;
    completed: boolean;
  }
  const progress: ProgressSpec[] = [
    // course-fashion-foundations — 4/4 = 100% (completed)
    { lessonKey: "lesson-color-theory", courseKey: "course-fashion-foundations", completed: true },
    {
      lessonKey: "lesson-form-silhouette",
      courseKey: "course-fashion-foundations",
      completed: true,
    },
    {
      lessonKey: "lesson-croquis-templates",
      courseKey: "course-fashion-foundations",
      completed: true,
    },
    {
      lessonKey: "lesson-fabric-texture",
      courseKey: "course-fashion-foundations",
      completed: true,
    },
    // course-architectural-drafting — 1/2 = 50% (in progress)
    {
      lessonKey: "lesson-reading-floor-plans",
      courseKey: "course-architectural-drafting",
      completed: true,
    },
    {
      lessonKey: "lesson-elevation-drawing",
      courseKey: "course-architectural-drafting",
      completed: false,
    },
    // course-pattern-making — 3/4 = 75% (in progress, strong performer)
    { lessonKey: "lesson-drafting-bodice", courseKey: "course-pattern-making", completed: true },
    { lessonKey: "lesson-dart-manipulation", courseKey: "course-pattern-making", completed: true },
    {
      lessonKey: "lesson-fitting-adjustments",
      courseKey: "course-pattern-making",
      completed: true,
    },
    { lessonKey: "lesson-sleeve-drafting", courseKey: "course-pattern-making", completed: false },
    // course-nid-entrance-prep — 1/5 = 20% (in progress, weak area)
    {
      lessonKey: "lesson-nid-exam-pattern",
      courseKey: "course-nid-entrance-prep",
      completed: true,
    },
    {
      lessonKey: "lesson-visual-design-sensitivity",
      courseKey: "course-nid-entrance-prep",
      completed: false,
    },
    {
      lessonKey: "lesson-materials-and-manufacturing",
      courseKey: "course-nid-entrance-prep",
      completed: false,
    },
    {
      lessonKey: "lesson-environmental-awareness",
      courseKey: "course-nid-entrance-prep",
      completed: false,
    },
    {
      lessonKey: "lesson-creative-problem-solving",
      courseKey: "course-nid-entrance-prep",
      completed: false,
    },
    // course-design-basics deliberately has NO progress rows — see comment above.
  ];
  for (const p of progress) {
    await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: studentId, lessonId: seedId(p.lessonKey) } },
      update: { completedAt: p.completed ? new Date() : null },
      create: {
        userId: studentId,
        lessonId: seedId(p.lessonKey),
        courseId: seedId(p.courseKey),
        completedAt: p.completed ? new Date() : null,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Assessment & Quiz Engine. Scoring mirrors the real formula exactly
// (apps/api/src/assessment/quiz-attempts/scoring.util.ts:40-102 — exact-set
// match per question, wrong answers cost negativeMarksPerWrong × marks when
// negativeMarkingEnabled, unanswered scores 0 and is never penalized) so
// every seeded QuizAttempt's numbers are internally consistent, not just
// plausible-looking. Four quizzes tell a deliberate "strengths and
// weaknesses" story for the demo student (QuizRecommendationService only
// recommends PUBLISHED quizzes in enrolled subjects the student hasn't
// attempted yet — apps/api/src/recommendations/quiz/quiz-recommendation
// .service.ts:25-79 — so exactly one quiz here is left unattempted):
//   - Design Fundamentals Quiz      (attempted, ~68%  — average)
//   - Pattern Construction Quiz     (attempted,  90%  — strong area)
//   - Design Aptitude Diagnostic    (attempted, 37.5% — weak area, failed)
//   - Advanced Color Theory Quiz    (not attempted — surfaces as a quiz
//     recommendation for the student's 100%-complete Foundations course)
// ---------------------------------------------------------------------------
async function seedAssessments(ids: DemoUserIds): Promise<void> {
  const { adminId, studentId } = ids;

  interface OptionSpec {
    key: string;
    text: string;
    isCorrect: boolean;
  }
  interface QuestionSpec {
    key: string;
    type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";
    text: string;
    marks: number;
    options: OptionSpec[];
    /** Option keys the seeded student attempt selects; [] = left unanswered. */
    selected: string[];
  }
  interface QuizConfig {
    key: string;
    subjectKey: string;
    title: string;
    slug: string;
    description: string;
    passingScorePercent: string;
    negativeMarkingEnabled: boolean;
    negativeMarksPerWrong: string;
    questions: QuestionSpec[];
    /** false = leave unattempted (a quiz-recommendation candidate). */
    attempted: boolean;
  }

  const quizzes: QuizConfig[] = [
    {
      key: "quiz-design-fundamentals",
      subjectKey: "subject-design-fundamentals",
      title: "Design Fundamentals Quiz",
      slug: "demo-design-fundamentals-quiz",
      description: "A short quiz covering core design vocabulary — seeded for local development.",
      passingScorePercent: "40",
      negativeMarkingEnabled: true,
      negativeMarksPerWrong: "0.25",
      attempted: true,
      questions: [
        {
          key: "q-color-model",
          type: "SINGLE_CHOICE",
          text: "Which color model is standard for digital/screen design?",
          marks: 2,
          options: [
            { key: "q1-rgb", text: "RGB", isCorrect: true },
            { key: "q1-cmyk", text: "CMYK", isCorrect: false },
            { key: "q1-pantone", text: "Pantone", isCorrect: false },
            { key: "q1-hsl-only", text: "HSL only", isCorrect: false },
          ],
          selected: ["q1-rgb"],
        },
        {
          key: "q-design-principles",
          type: "MULTIPLE_CHOICE",
          text: "Which of these are core design principles?",
          marks: 3,
          options: [
            { key: "q2-balance", text: "Balance", isCorrect: true },
            { key: "q2-contrast", text: "Contrast", isCorrect: true },
            { key: "q2-rhythm", text: "Rhythm", isCorrect: true },
            { key: "q2-gravity", text: "Gravity", isCorrect: false },
          ],
          selected: ["q2-balance", "q2-contrast", "q2-rhythm"],
        },
        {
          key: "q-sketching-optional",
          type: "TRUE_FALSE",
          text: "Sketching is an optional step in the design process.",
          marks: 1,
          options: [
            { key: "q3-true", text: "True", isCorrect: false },
            { key: "q3-false", text: "False", isCorrect: true },
          ],
          selected: ["q3-true"], // deliberately wrong, to demo negative marking
        },
        {
          key: "q-cad-meaning",
          type: "SINGLE_CHOICE",
          text: "What does CAD stand for?",
          marks: 2,
          options: [
            { key: "q4-computer-aided", text: "Computer-Aided Design", isCorrect: true },
            { key: "q4-creative-art", text: "Creative Art Design", isCorrect: false },
            { key: "q4-central-assembly", text: "Central Assembly Drawing", isCorrect: false },
            { key: "q4-custom-adaptive", text: "Custom Adaptive Design", isCorrect: false },
          ],
          selected: ["q4-computer-aided"],
        },
        {
          key: "q-moodboard-purpose",
          type: "SINGLE_CHOICE",
          text: "What is the primary purpose of a mood board?",
          marks: 2,
          options: [
            {
              key: "q5-communicate-direction",
              text: "Communicate a visual/creative direction",
              isCorrect: true,
            },
            { key: "q5-final-invoice", text: "Generate a final client invoice", isCorrect: false },
            { key: "q5-fabric-order", text: "Place a fabric supplier order", isCorrect: false },
            { key: "q5-size-chart", text: "Define garment size charts", isCorrect: false },
          ],
          selected: [], // left unanswered
        },
      ],
    },
    {
      key: "quiz-pattern-construction",
      subjectKey: "subject-pattern-construction",
      title: "Pattern Construction Skills Quiz",
      slug: "demo-pattern-construction-skills-quiz",
      description:
        "Checks core pattern-making vocabulary and technique — seeded for local development.",
      passingScorePercent: "40",
      negativeMarkingEnabled: false,
      negativeMarksPerWrong: "0",
      attempted: true,
      questions: [
        {
          key: "q-pattern-block-basics",
          type: "SINGLE_CHOICE",
          text: "What is a sloper/basic block used for in pattern making?",
          marks: 3,
          options: [
            {
              key: "qp1-foundation",
              text: "A foundational pattern used to create other pattern variations",
              isCorrect: true,
            },
            {
              key: "qp1-finished-garment",
              text: "A finished, ready-to-wear garment",
              isCorrect: false,
            },
            {
              key: "qp1-fabric-swatch",
              text: "A fabric swatch for color matching",
              isCorrect: false,
            },
            { key: "qp1-shipping-label", text: "A shipping label template", isCorrect: false },
          ],
          selected: ["qp1-foundation"],
        },
        {
          key: "q-pattern-dart-purpose",
          type: "SINGLE_CHOICE",
          text: "What is the primary purpose of a dart in garment construction?",
          marks: 3,
          options: [
            {
              key: "qp2-shape-curves",
              text: "To shape flat fabric around body curves",
              isCorrect: true,
            },
            { key: "qp2-decoration-only", text: "Purely decorative stitching", isCorrect: false },
            {
              key: "qp2-seam-finishing",
              text: "A method of finishing raw seam edges",
              isCorrect: false,
            },
            { key: "qp2-fabric-saving", text: "A way to reduce fabric usage", isCorrect: false },
          ],
          selected: ["qp2-shape-curves"],
        },
        {
          key: "q-pattern-seam-allowance",
          type: "SINGLE_CHOICE",
          text: "What is a commonly used standard seam allowance in pattern making?",
          marks: 3,
          options: [
            { key: "qp3-1-5cm", text: "1.5 cm (5/8 inch)", isCorrect: true },
            { key: "qp3-10cm", text: "10 cm", isCorrect: false },
            { key: "qp3-0cm", text: "0 cm — seams are never allowed for", isCorrect: false },
            { key: "qp3-25cm", text: "25 cm", isCorrect: false },
          ],
          selected: ["qp3-1-5cm"],
        },
        {
          key: "q-pattern-grainline",
          type: "SINGLE_CHOICE",
          text: "Which direction does the fabric grainline typically run on a bodice front pattern piece?",
          marks: 1,
          options: [
            {
              key: "qp4-lengthwise-cf",
              text: "Parallel to the center front, lengthwise",
              isCorrect: true,
            },
            { key: "qp4-diagonal", text: "Always on the diagonal (true bias)", isCorrect: false },
            { key: "qp4-hemline", text: "Parallel to the hemline only", isCorrect: false },
            { key: "qp4-random", text: "Direction doesn't matter", isCorrect: false },
          ],
          selected: ["qp4-diagonal"], // deliberately wrong — one miss, still a strong 90%
        },
      ],
    },
    {
      key: "quiz-design-aptitude-diagnostic",
      subjectKey: "subject-nid-exam-prep",
      title: "Design Aptitude Diagnostic Quiz",
      slug: "demo-design-aptitude-diagnostic-quiz",
      description:
        "Diagnostic quiz for observation, logical reasoning, and design-awareness — seeded for local development.",
      passingScorePercent: "40",
      negativeMarkingEnabled: true,
      negativeMarksPerWrong: "0.25",
      attempted: true,
      questions: [
        {
          key: "q-aptitude-observation",
          type: "SINGLE_CHOICE",
          text: "In a design aptitude test, an 'odd one out' question primarily evaluates which skill?",
          marks: 2,
          options: [
            {
              key: "qa1-observation",
              text: "Observation and pattern recognition",
              isCorrect: true,
            },
            { key: "qa1-memory", text: "Long-term memory recall", isCorrect: false },
            { key: "qa1-typing-speed", text: "Typing speed", isCorrect: false },
            { key: "qa1-vocabulary", text: "Vocabulary size", isCorrect: false },
          ],
          selected: ["qa1-observation"],
        },
        {
          key: "q-aptitude-logical-sequence",
          type: "SINGLE_CHOICE",
          text: "What comes next in the sequence 2, 4, 8, 16, ?",
          marks: 2,
          options: [
            { key: "qa2-32", text: "32", isCorrect: true },
            { key: "qa2-24", text: "24", isCorrect: false },
            { key: "qa2-18", text: "18", isCorrect: false },
            { key: "qa2-20", text: "20", isCorrect: false },
          ],
          selected: ["qa2-32"],
        },
        {
          key: "q-aptitude-visual-proportion",
          type: "SINGLE_CHOICE",
          text: "In visual composition, the 'rule of thirds' primarily helps with which aspect?",
          marks: 2,
          options: [
            { key: "qa3-balance-placement", text: "Balanced element placement", isCorrect: true },
            { key: "qa3-color-mixing", text: "Mixing paint colors", isCorrect: false },
            { key: "qa3-fabric-cost", text: "Estimating fabric cost", isCorrect: false },
            { key: "qa3-file-size", text: "Reducing digital file size", isCorrect: false },
          ],
          selected: ["qa3-color-mixing"], // wrong
        },
        {
          key: "q-aptitude-materials-awareness",
          type: "SINGLE_CHOICE",
          text: "Which of these is generally considered a sustainable/eco-friendly material choice?",
          marks: 2,
          options: [
            { key: "qa4-bamboo", text: "Bamboo fiber", isCorrect: true },
            { key: "qa4-single-use-plastic", text: "Single-use plastic", isCorrect: false },
            { key: "qa4-styrofoam", text: "Styrofoam", isCorrect: false },
            { key: "qa4-non-recyclable", text: "Non-recyclable composite", isCorrect: false },
          ],
          selected: ["qa4-single-use-plastic"], // wrong
        },
      ],
    },
    {
      key: "quiz-advanced-color-theory",
      subjectKey: "subject-design-fundamentals",
      title: "Advanced Color Theory Quiz",
      slug: "demo-advanced-color-theory-quiz",
      description:
        "A follow-up quiz on color relationships — seeded for local development, not yet attempted.",
      passingScorePercent: "40",
      negativeMarkingEnabled: false,
      negativeMarksPerWrong: "0",
      attempted: false,
      questions: [
        {
          key: "q-color-secondary",
          type: "SINGLE_CHOICE",
          text: "Which color is a secondary color, made by mixing two primary colors?",
          marks: 2,
          options: [
            { key: "qc1-green", text: "Green", isCorrect: true },
            { key: "qc1-red", text: "Red", isCorrect: false },
            { key: "qc1-blue", text: "Blue", isCorrect: false },
            { key: "qc1-yellow", text: "Yellow", isCorrect: false },
          ],
          selected: [],
        },
        {
          key: "q-color-complementary",
          type: "SINGLE_CHOICE",
          text: "On a standard color wheel, which color is complementary to blue?",
          marks: 2,
          options: [
            { key: "qc2-orange", text: "Orange", isCorrect: true },
            { key: "qc2-green", text: "Green", isCorrect: false },
            { key: "qc2-violet", text: "Violet", isCorrect: false },
            { key: "qc2-red", text: "Red", isCorrect: false },
          ],
          selected: [],
        },
        {
          key: "q-color-warm-cool",
          type: "MULTIPLE_CHOICE",
          text: "Which of these are typically considered warm colors?",
          marks: 2,
          options: [
            { key: "qc3-red", text: "Red", isCorrect: true },
            { key: "qc3-orange", text: "Orange", isCorrect: true },
            { key: "qc3-blue", text: "Blue", isCorrect: false },
            { key: "qc3-yellow", text: "Yellow", isCorrect: true },
          ],
          selected: [],
        },
      ],
    },
  ];

  for (const quiz of quizzes) {
    const quizId = seedId(quiz.key);
    const subjectId = seedId(quiz.subjectKey);

    await prisma.quiz.upsert({
      where: { id: quizId },
      update: {},
      create: {
        id: quizId,
        subjectId,
        title: quiz.title,
        slug: quiz.slug,
        description: quiz.description,
        status: "PUBLISHED",
        timeLimitMinutes: 20,
        passingScorePercent: quiz.passingScorePercent,
        negativeMarkingEnabled: quiz.negativeMarkingEnabled,
        negativeMarksPerWrong: quiz.negativeMarksPerWrong,
        publishedAt: new Date(),
        createdById: adminId,
      },
    });

    for (const [index, q] of quiz.questions.entries()) {
      await prisma.question.upsert({
        where: { id: seedId(q.key) },
        update: {},
        create: {
          id: seedId(q.key),
          subjectId,
          type: q.type,
          difficulty: "MEDIUM",
          text: q.text,
          status: "PUBLISHED",
          createdById: adminId,
        },
      });

      for (const [optIndex, opt] of q.options.entries()) {
        await prisma.questionOption.upsert({
          where: { id: seedId(opt.key) },
          update: {},
          create: {
            id: seedId(opt.key),
            questionId: seedId(q.key),
            text: opt.text,
            isCorrect: opt.isCorrect,
            position: optIndex,
          },
        });
      }

      await prisma.quizQuestion.upsert({
        where: { quizId_questionId: { quizId, questionId: seedId(q.key) } },
        update: {},
        create: {
          id: seedId(`quiz-question:${q.key}`),
          quizId,
          questionId: seedId(q.key),
          marks: q.marks,
          position: index,
        },
      });
    }

    if (!quiz.attempted) continue;

    // --- Score the seeded attempt exactly like scoring.util.ts does. ---
    const negativeMarksPerWrong = quiz.negativeMarkingEnabled
      ? Number(quiz.negativeMarksPerWrong)
      : 0;
    let obtainedMarks = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;

    for (const q of quiz.questions) {
      const correctKeys = new Set(q.options.filter((o) => o.isCorrect).map((o) => o.key));
      if (q.selected.length === 0) {
        unansweredCount++;
        continue;
      }
      const selectedSet = new Set(q.selected);
      const isCorrect =
        selectedSet.size === correctKeys.size && [...selectedSet].every((k) => correctKeys.has(k));
      if (isCorrect) {
        correctCount++;
        obtainedMarks += q.marks;
      } else {
        wrongCount++;
        obtainedMarks -= q.marks * negativeMarksPerWrong;
      }
    }
    const totalMarks = quiz.questions.reduce((sum, q) => sum + q.marks, 0);
    obtainedMarks = Math.round(obtainedMarks * 100) / 100;
    const percentage = totalMarks > 0 ? Math.round((obtainedMarks / totalMarks) * 10000) / 100 : 0;
    const passed = percentage >= Number(quiz.passingScorePercent);

    const questionSnapshot = quiz.questions.map((q, i) => ({
      questionId: seedId(q.key),
      sectionId: null,
      marks: q.marks,
      position: i,
    }));
    const optionOrder = Object.fromEntries(
      quiz.questions.map((q) => [seedId(q.key), q.options.map((o) => seedId(o.key))]),
    );

    // Preserves the original Design Fundamentals attempt's historical id
    // label exactly (deterministic-id stability for already-seeded
    // databases); every other quiz gets a fresh, quiz-scoped label.
    const attemptId = seedId(
      quiz.key === "quiz-design-fundamentals"
        ? "quiz-attempt-student-design-fundamentals"
        : `quiz-attempt-student:${quiz.key}`,
    );
    await prisma.quizAttempt.upsert({
      where: { id: attemptId },
      update: {},
      create: {
        id: attemptId,
        quizId,
        userId: studentId,
        status: "SUBMITTED",
        questionSnapshot,
        optionOrder,
        passingScorePercent: quiz.passingScorePercent,
        negativeMarkingEnabled: quiz.negativeMarkingEnabled,
        negativeMarksPerWrong: quiz.negativeMarksPerWrong,
        totalMarks,
        submittedAt: new Date(),
        obtainedMarks,
        percentage,
        passed,
        correctCount,
        wrongCount,
        unansweredCount,
      },
    });

    for (const q of quiz.questions) {
      const correctKeys = new Set(q.options.filter((o) => o.isCorrect).map((o) => o.key));
      const isCorrect =
        q.selected.length === 0
          ? null
          : new Set(q.selected).size === correctKeys.size &&
            q.selected.every((k) => correctKeys.has(k));
      const marksAwarded =
        q.selected.length === 0 ? 0 : isCorrect ? q.marks : -(q.marks * negativeMarksPerWrong);

      await prisma.quizAttemptAnswer.upsert({
        where: { attemptId_questionId: { attemptId, questionId: seedId(q.key) } },
        update: {},
        create: {
          id: seedId(
            quiz.key === "quiz-design-fundamentals"
              ? `quiz-attempt-answer:${q.key}`
              : `quiz-attempt-answer:${quiz.key}:${q.key}`,
          ),
          attemptId,
          questionId: seedId(q.key),
          selectedOptionIds: q.selected.map((k) => seedId(k)),
          isCorrect,
          marksAwarded,
          answeredAt: q.selected.length > 0 ? new Date() : null,
        },
      });
    }
  }
}

/**
 * Best-effort real upload of a tiny, harmless demo file for the seeded
 * assignment submission — same S3-compatible client/config apps/api's
 * S3StorageService uses (configuration.ts's `storage.*`), so a successful
 * upload lands a genuinely downloadable object, not a fake reference. Never
 * blocks or fails the seed: a native-Postgres-only environment typically has
 * no MinIO/S3 at all, so this must degrade to "skip" quickly and quietly,
 * not hang waiting on a connection nothing will ever answer. 3s is enough
 * for a local MinIO to respond; a real timeout/refusal fails much faster.
 */
async function tryUploadDemoSubmissionFile(key: string, content: string): Promise<boolean> {
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: content, ContentType: "text/plain" }),
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

// ---------------------------------------------------------------------------
// Creative Assignment Engine. Publishing requires >=1 RubricCriterion
// (assignments-admin.service.ts:150-162); a SUBMITTED submission requires
// >=1 SubmissionFile (submissions.service.ts:208-215); publishing a review
// requires a RubricScore for every criterion, no partial (reviewer.service.ts
// :113-119). Every seeded submission's file record only exists if a real
// upload actually succeeds (tryUploadDemoSubmissionFile above) — no
// SubmissionFile row is created at all when S3/MinIO is unavailable (a
// native-Postgres-only environment usually has neither), rather than
// pointing at a storage key that would 404 on download. Confirmed safe:
// WITH_DETAIL's `files` is a plain Prisma relation include
// (submissions.service.ts:22) — an empty array, not an error, when no files
// exist. Publishing still works because the business rule requiring >=1
// file only gates the SUBMITTED transition through the real API
// (submitFinal), not a submission already sitting at APPROVED via direct
// seeding. Three assignments cover every submission state the demo needs:
//   - Portfolio Piece: Product Redesign  — APPROVED, published review (21/25)
//   - Mood Board: Design Direction       — SUBMITTED, awaiting review (no
//     AssignmentReview row, reviewerId left null — unclaimed)
//   - Sketchbook Challenge: 10 Croquis   — PUBLISHED, no submission at all
//     (also the AssignmentRecommendationService candidate for the student's
//     enrolled Pattern Construction subject)
// ---------------------------------------------------------------------------
async function seedAssignments(ids: DemoUserIds): Promise<void> {
  const { studentId, mentorId } = ids;
  const subjectId = seedId("subject-pattern-construction");
  const assignmentId = seedId("assignment-portfolio-redesign");
  const submissionId = seedId("assignment-submission-student-portfolio");
  const reviewId = seedId("assignment-review-student-portfolio");

  await prisma.assignment.upsert({
    where: { id: assignmentId },
    update: {},
    create: {
      id: assignmentId,
      subjectId,
      title: "Portfolio Piece: Product Redesign",
      slug: "demo-portfolio-product-redesign",
      brief:
        "Redesign an everyday product with a focus on user-centered form. Submit a PDF or image portfolio " +
        "documenting your concept, process sketches, and final presentation.",
      fileRules: {
        allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg"],
        maxFileSizeMb: 25,
        maxFiles: 5,
      },
      marksTotal: "25",
      status: "PUBLISHED",
      publishedAt: new Date(),
      createdById: mentorId,
    },
  });

  const criteria = [
    { key: "criterion-concept", title: "Concept & Ideation", maxMarks: 10, awarded: 8 },
    { key: "criterion-execution", title: "Execution & Craft", maxMarks: 10, awarded: 9 },
    { key: "criterion-presentation", title: "Presentation", maxMarks: 5, awarded: 4 },
  ];
  for (const [index, c] of criteria.entries()) {
    await prisma.rubricCriterion.upsert({
      where: { id: seedId(c.key) },
      update: {},
      create: {
        id: seedId(c.key),
        assignmentId,
        title: c.title,
        maxMarks: c.maxMarks,
        position: index,
      },
    });
  }

  await prisma.assignmentSubmission.upsert({
    where: { assignmentId_studentId_version: { assignmentId, studentId, version: 1 } },
    update: {},
    create: {
      id: submissionId,
      assignmentId,
      studentId,
      version: 1,
      status: "APPROVED",
      notes:
        "First submission — redesigned an ergonomic desk lamp with a focus on adjustable lighting angles.",
      reviewerId: mentorId,
      submittedAt: new Date(),
    },
  });

  const demoFileKey = `demo-seed/assignments/${submissionId}/portfolio-notes.txt`;
  const demoFileContent =
    "Examora demo submission file — seeded for local development.\n" +
    "Redesigned an ergonomic desk lamp with a focus on adjustable lighting angles.\n";
  const uploaded = await tryUploadDemoSubmissionFile(demoFileKey, demoFileContent);
  if (uploaded) {
    await prisma.submissionFile.upsert({
      where: { id: seedId("submission-file-portfolio") },
      update: {
        storageKey: demoFileKey,
        fileName: "portfolio-notes.txt",
        mimeType: "text/plain",
        sizeBytes: Buffer.byteLength(demoFileContent),
        scanStatus: "CLEAN",
      },
      create: {
        id: seedId("submission-file-portfolio"),
        submissionId,
        fileName: "portfolio-notes.txt",
        mimeType: "text/plain",
        sizeBytes: Buffer.byteLength(demoFileContent),
        storageKey: demoFileKey,
        scanStatus: "CLEAN",
      },
    });
    // eslint-disable-next-line no-console -- seed script CLI output, not application logging
    console.log(`  Uploaded a real demo submission file to S3/MinIO (${demoFileKey}).`);
  } else {
    // eslint-disable-next-line no-console -- seed script CLI output, not application logging
    console.log(
      "  S3/MinIO unavailable — skipped the demo submission file (no fake, non-downloadable record created).",
    );
  }

  const obtainedMarks = criteria.reduce((sum, c) => sum + c.awarded, 0);
  await prisma.assignmentReview.upsert({
    where: { submissionId },
    update: {},
    create: {
      id: reviewId,
      submissionId,
      reviewerId: mentorId,
      status: "PUBLISHED",
      overallComment:
        "Strong concept and clean execution — presentation could use tighter annotation.",
      decision: "APPROVED",
      obtainedMarks,
      publishedAt: new Date(),
    },
  });

  for (const c of criteria) {
    await prisma.rubricScore.upsert({
      where: { reviewId_criterionId: { reviewId, criterionId: seedId(c.key) } },
      update: {},
      create: {
        id: seedId(`rubric-score:${c.key}`),
        reviewId,
        criterionId: seedId(c.key),
        marksAwarded: c.awarded,
      },
    });
  }

  const comments = [
    {
      key: "assignment-comment-student",
      authorId: studentId,
      body: "Let me know if the process sketches need more detail!",
    },
    {
      key: "assignment-comment-mentor",
      authorId: mentorId,
      body: "Looks great — see rubric feedback for the one area to tighten up.",
    },
  ];
  for (const c of comments) {
    await prisma.assignmentComment.upsert({
      where: { id: seedId(c.key) },
      update: {},
      create: { id: seedId(c.key), submissionId, authorId: c.authorId, body: c.body },
    });
  }

  // --- Assignment 2: submitted, awaiting review (no AssignmentReview yet,
  // reviewerId left null — nobody has claimed it from the reviewer queue). ---
  const moodboardSubjectId = seedId("subject-design-fundamentals");
  const moodboardAssignmentId = seedId("assignment-moodboard-design-direction");
  const moodboardSubmissionId = seedId("assignment-submission-student-moodboard");

  await prisma.assignment.upsert({
    where: { id: moodboardAssignmentId },
    update: {},
    create: {
      id: moodboardAssignmentId,
      subjectId: moodboardSubjectId,
      title: "Mood Board: Design Direction",
      slug: "demo-moodboard-design-direction",
      brief:
        "Build a mood board that communicates a clear visual/creative direction for a spring " +
        "collection. Include color palette, texture references, and a one-paragraph rationale.",
      fileRules: {
        allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg"],
        maxFileSizeMb: 25,
        maxFiles: 5,
      },
      marksTotal: "20",
      status: "PUBLISHED",
      publishedAt: new Date(),
      createdById: mentorId,
    },
  });

  const moodboardCriteria = [
    { key: "criterion-moodboard-direction", title: "Clarity of Direction", maxMarks: 10 },
    { key: "criterion-moodboard-cohesion", title: "Visual Cohesion", maxMarks: 10 },
  ];
  for (const [index, c] of moodboardCriteria.entries()) {
    await prisma.rubricCriterion.upsert({
      where: { id: seedId(c.key) },
      update: {},
      create: {
        id: seedId(c.key),
        assignmentId: moodboardAssignmentId,
        title: c.title,
        maxMarks: c.maxMarks,
        position: index,
      },
    });
  }

  await prisma.assignmentSubmission.upsert({
    where: {
      assignmentId_studentId_version: {
        assignmentId: moodboardAssignmentId,
        studentId,
        version: 1,
      },
    },
    update: {},
    create: {
      id: moodboardSubmissionId,
      assignmentId: moodboardAssignmentId,
      studentId,
      version: 1,
      status: "SUBMITTED",
      notes: "Spring collection mood board — palette inspired by early-morning coastal light.",
      reviewerId: null,
      submittedAt: new Date(),
    },
  });

  const moodboardFileKey = `demo-seed/assignments/${moodboardSubmissionId}/moodboard-notes.txt`;
  const moodboardFileContent =
    "Examora demo submission file — seeded for local development.\n" +
    "Spring collection mood board — palette inspired by early-morning coastal light.\n";
  const moodboardUploaded = await tryUploadDemoSubmissionFile(
    moodboardFileKey,
    moodboardFileContent,
  );
  if (moodboardUploaded) {
    await prisma.submissionFile.upsert({
      where: { id: seedId("submission-file-moodboard") },
      update: {
        storageKey: moodboardFileKey,
        fileName: "moodboard-notes.txt",
        mimeType: "text/plain",
        sizeBytes: Buffer.byteLength(moodboardFileContent),
        scanStatus: "CLEAN",
      },
      create: {
        id: seedId("submission-file-moodboard"),
        submissionId: moodboardSubmissionId,
        fileName: "moodboard-notes.txt",
        mimeType: "text/plain",
        sizeBytes: Buffer.byteLength(moodboardFileContent),
        storageKey: moodboardFileKey,
        scanStatus: "CLEAN",
      },
    });
    // eslint-disable-next-line no-console -- seed script CLI output, not application logging
    console.log(`  Uploaded a real demo submission file to S3/MinIO (${moodboardFileKey}).`);
  } else {
    // eslint-disable-next-line no-console -- seed script CLI output, not application logging
    console.log(
      "  S3/MinIO unavailable — skipped the moodboard submission file (no fake, non-downloadable record created).",
    );
  }

  // --- Assignment 3: published, not yet submitted by the student — also
  // the AssignmentRecommendationService candidate for Pattern Construction
  // (any PUBLISHED assignment in an enrolled subject with no non-DRAFT
  // submission — apps/api/src/recommendations/assignment/assignment
  // -recommendation.service.ts:24-83). ---
  const sketchbookAssignmentId = seedId("assignment-sketchbook-challenge");
  await prisma.assignment.upsert({
    where: { id: sketchbookAssignmentId },
    update: {},
    create: {
      id: sketchbookAssignmentId,
      subjectId,
      title: "Sketchbook Challenge: 10 Croquis Studies",
      slug: "demo-sketchbook-challenge-10-croquis-studies",
      brief:
        "Fill 10 croquis figure templates exploring different poses and silhouettes. Submit a " +
        "single scanned PDF of all 10 studies.",
      fileRules: {
        allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg"],
        maxFileSizeMb: 15,
        maxFiles: 1,
      },
      marksTotal: "15",
      status: "PUBLISHED",
      publishedAt: new Date(),
      createdById: mentorId,
    },
  });

  const sketchbookCriteria = [
    { key: "criterion-sketchbook-variety", title: "Pose & Silhouette Variety", maxMarks: 8 },
    { key: "criterion-sketchbook-technique", title: "Line Technique", maxMarks: 7 },
  ];
  for (const [index, c] of sketchbookCriteria.entries()) {
    await prisma.rubricCriterion.upsert({
      where: { id: seedId(c.key) },
      update: {},
      create: {
        id: seedId(c.key),
        assignmentId: sketchbookAssignmentId,
        title: c.title,
        maxMarks: c.maxMarks,
        position: index,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Mentor Workspace — enough for Student 360, the mentor dashboard, and
// mentor analytics to show real, non-empty data.
// ---------------------------------------------------------------------------
async function seedMentorWorkspace(ids: DemoUserIds): Promise<void> {
  const { adminId, mentorId, studentId } = ids;

  await prisma.mentorAssignment.upsert({
    where: { id: seedId("mentor-assignment-student") },
    update: {},
    create: {
      id: seedId("mentor-assignment-student"),
      studentId,
      mentorId,
      assignedById: adminId,
      unassignedAt: null,
    },
  });

  const notes = [
    {
      key: "mentor-note-1",
      body: "Strong grasp of color theory already — push toward more experimental silhouettes next.",
    },
    {
      key: "mentor-note-2",
      body: "Struggled with the bodice block dart manipulation — worth a follow-up 1:1.",
    },
  ];
  for (const n of notes) {
    await prisma.mentorNote.upsert({
      where: { id: seedId(n.key) },
      update: {},
      create: { id: seedId(n.key), studentId, mentorId, body: n.body },
    });
  }

  const tasks = [
    {
      key: "mentor-task-1",
      title: "Review portfolio submission feedback",
      status: "COMPLETED" as const,
      completed: true,
    },
    {
      key: "mentor-task-2",
      title: "Practice dart manipulation exercises",
      status: "PENDING" as const,
      completed: false,
    },
  ];
  for (const t of tasks) {
    await prisma.mentorTask.upsert({
      where: { id: seedId(t.key) },
      update: {},
      create: {
        id: seedId(t.key),
        studentId,
        mentorId,
        title: t.title,
        status: t.status,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        completedAt: t.completed ? new Date() : null,
      },
    });
  }

  const feedback = [
    {
      key: "mentor-feedback-1",
      body: "Great progress on the color theory lesson — your palette choices are getting much more confident.",
    },
    {
      key: "mentor-feedback-2",
      body: "Your product redesign portfolio shows real growth in presentation clarity since last month.",
    },
  ];
  for (const f of feedback) {
    await prisma.mentorFeedback.upsert({
      where: { id: seedId(f.key) },
      update: {},
      create: { id: seedId(f.key), studentId, mentorId, body: f.body },
    });
  }

  await prisma.mentorMeeting.upsert({
    where: { id: seedId("mentor-meeting-1") },
    update: {},
    create: {
      id: seedId("mentor-meeting-1"),
      studentId,
      mentorId,
      occurredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      durationMinutes: 30,
      summary: "Reviewed portfolio direction and set goals for the pattern-making module.",
    },
  });
}

// ---------------------------------------------------------------------------
// Community & Discussion. CommunityProfile/ReputationEvent mirror the real
// award()-style increment pattern (reputation.service.ts:16-24) rather than
// setting reputationPoints directly, so the ledger and the denormalized
// total stay consistent the same way production code keeps them consistent.
// ---------------------------------------------------------------------------
async function seedCommunity(ids: DemoUserIds): Promise<void> {
  const { mentorId, studentId } = ids;

  await prisma.forumCategory.upsert({
    where: { id: seedId("forum-category-general") },
    update: {},
    create: {
      id: seedId("forum-category-general"),
      title: "General Discussion",
      slug: "demo-general-discussion",
      description: "Say hello and connect with other students.",
      createdById: mentorId,
    },
  });
  await prisma.forumCategory.upsert({
    where: { id: seedId("forum-category-help") },
    update: {},
    create: {
      id: seedId("forum-category-help"),
      title: "Design Help",
      slug: "demo-design-help",
      description: "Ask questions about coursework and get help from mentors and peers.",
      createdById: mentorId,
    },
  });

  await prisma.forumBoard.upsert({
    where: {
      categoryId_slug: { categoryId: seedId("forum-category-general"), slug: "introductions" },
    },
    update: {},
    create: {
      id: seedId("forum-board-introductions"),
      categoryId: seedId("forum-category-general"),
      title: "Introductions",
      slug: "introductions",
      createdById: mentorId,
    },
  });
  await prisma.forumBoard.upsert({
    where: {
      categoryId_slug: {
        categoryId: seedId("forum-category-help"),
        slug: "fashion-and-textile-help",
      },
    },
    update: {},
    create: {
      id: seedId("forum-board-fashion-help"),
      categoryId: seedId("forum-category-help"),
      title: "Fashion & Textile Help",
      slug: "fashion-and-textile-help",
      createdById: mentorId,
    },
  });
  await prisma.forumBoard.upsert({
    where: {
      categoryId_slug: {
        categoryId: seedId("forum-category-help"),
        slug: "entrance-exam-prep",
      },
    },
    update: {},
    create: {
      id: seedId("forum-board-entrance-exam-prep"),
      categoryId: seedId("forum-category-help"),
      title: "Entrance Exam Prep",
      slug: "entrance-exam-prep",
      createdById: mentorId,
    },
  });

  await prisma.thread.upsert({
    where: { id: seedId("thread-intro-student") },
    update: {},
    create: {
      id: seedId("thread-intro-student"),
      boardId: seedId("forum-board-introductions"),
      authorId: studentId,
      type: "DISCUSSION",
      title: "Excited to start my design journey!",
      body: "Just enrolled in Foundations of Fashion Design — looking forward to connecting with everyone here.",
    },
  });
  await prisma.thread.upsert({
    where: { id: seedId("thread-fabric-question") },
    update: {},
    create: {
      id: seedId("thread-fabric-question"),
      boardId: seedId("forum-board-fashion-help"),
      authorId: studentId,
      type: "QUESTION",
      title: "How do I choose the right fabric weight for draping?",
      body: "I keep getting inconsistent results when draping — is there a rule of thumb for matching fabric weight to silhouette?",
      isSolved: true,
    },
  });
  await prisma.thread.upsert({
    where: { id: seedId("thread-welcome-mentor") },
    update: {},
    create: {
      id: seedId("thread-welcome-mentor"),
      boardId: seedId("forum-board-introductions"),
      authorId: mentorId,
      type: "DISCUSSION",
      title: "Welcome, new students — introduce yourself here!",
      body: "New to Examora? Drop a note about what you're studying and what you're excited to learn.",
      isPinned: true,
    },
  });
  await prisma.thread.upsert({
    where: { id: seedId("thread-nid-prep-doubt") },
    update: {},
    create: {
      id: seedId("thread-nid-prep-doubt"),
      boardId: seedId("forum-board-entrance-exam-prep"),
      authorId: studentId,
      type: "QUESTION",
      title: "How should I structure my NID prep given limited time?",
      body: "I've just started the NID Entrance Preparation course and I'm not sure whether to focus on drawing practice or the aptitude sections first. Any advice?",
      isSolved: false,
    },
  });
  await prisma.thread.upsert({
    where: { id: seedId("thread-portfolio-tips") },
    update: {},
    create: {
      id: seedId("thread-portfolio-tips"),
      boardId: seedId("forum-board-fashion-help"),
      authorId: mentorId,
      type: "DISCUSSION",
      title: "5 tips for a stronger design portfolio",
      body: "A few things I always tell my mentees: curate ruthlessly, show process not just final pieces, keep a consistent visual language, tell a story with your sequencing, and get outside feedback early.",
    },
  });
  await prisma.thread.upsert({
    where: { id: seedId("thread-study-group") },
    update: {},
    create: {
      id: seedId("thread-study-group"),
      boardId: seedId("forum-board-introductions"),
      authorId: studentId,
      type: "DISCUSSION",
      title: "Anyone want to form a weekend study group?",
      body: "Looking for a few people working through the entrance-exam-prep courses to swap notes and practice sketches together on weekends.",
    },
  });

  await prisma.reply.upsert({
    where: { id: seedId("reply-fabric-answer") },
    update: {},
    create: {
      id: seedId("reply-fabric-answer"),
      threadId: seedId("thread-fabric-question"),
      authorId: mentorId,
      body: "Lighter fabrics (chiffon, voile) drape softly for fluid silhouettes; structured pieces need medium-to-heavy weight like wool crepe. Start with a muslin test in the target weight before cutting your final fabric.",
      isAcceptedAnswer: true,
    },
  });
  await prisma.reply.upsert({
    where: { id: seedId("reply-welcome-student") },
    update: {},
    create: {
      id: seedId("reply-welcome-student"),
      threadId: seedId("thread-welcome-mentor"),
      authorId: studentId,
      body: "Hi everyone! Starting with Foundations of Fashion Design — excited to be here.",
    },
  });
  await prisma.reply.upsert({
    where: { id: seedId("reply-intro-welcome") },
    update: {},
    create: {
      id: seedId("reply-intro-welcome"),
      threadId: seedId("thread-intro-student"),
      authorId: mentorId,
      body: "Welcome aboard! Feel free to post questions any time — happy to help.",
    },
  });
  await prisma.reply.upsert({
    where: { id: seedId("reply-nid-prep-advice") },
    update: {},
    create: {
      id: seedId("reply-nid-prep-advice"),
      threadId: seedId("thread-nid-prep-doubt"),
      authorId: mentorId,
      body: "Start with the aptitude sections — they build the observation habits that make the drawing/visualization sections easier later. Alternate between the two once you have the basics down.",
    },
  });
  await prisma.reply.upsert({
    where: { id: seedId("reply-study-group-interest") },
    update: {},
    create: {
      id: seedId("reply-study-group-interest"),
      threadId: seedId("thread-study-group"),
      authorId: mentorId,
      body: "Great idea — I'll pin this so more students see it. Happy to drop in for a Q&A session once you're set up.",
    },
  });

  const likes = [
    {
      key: "like-1",
      userId: studentId,
      targetType: "REPLY" as const,
      targetId: seedId("reply-fabric-answer"),
    },
    {
      key: "like-2",
      userId: mentorId,
      targetType: "THREAD" as const,
      targetId: seedId("thread-intro-student"),
    },
    {
      key: "like-3",
      userId: studentId,
      targetType: "THREAD" as const,
      targetId: seedId("thread-welcome-mentor"),
    },
    {
      key: "like-4",
      userId: studentId,
      targetType: "THREAD" as const,
      targetId: seedId("thread-portfolio-tips"),
    },
    {
      key: "like-5",
      userId: mentorId,
      targetType: "THREAD" as const,
      targetId: seedId("thread-study-group"),
    },
    {
      key: "like-6",
      userId: studentId,
      targetType: "REPLY" as const,
      targetId: seedId("reply-nid-prep-advice"),
    },
  ];
  for (const l of likes) {
    await prisma.communityLike.upsert({
      where: {
        userId_targetType_targetId: {
          userId: l.userId,
          targetType: l.targetType,
          targetId: l.targetId,
        },
      },
      update: {},
      create: {
        id: seedId(l.key),
        userId: l.userId,
        targetType: l.targetType,
        targetId: l.targetId,
      },
    });
  }

  await prisma.communityBookmark.upsert({
    where: { userId_threadId: { userId: studentId, threadId: seedId("thread-fabric-question") } },
    update: {},
    create: {
      id: seedId("bookmark-1"),
      userId: studentId,
      threadId: seedId("thread-fabric-question"),
    },
  });
  await prisma.communityBookmark.upsert({
    where: { userId_threadId: { userId: studentId, threadId: seedId("thread-portfolio-tips") } },
    update: {},
    create: {
      id: seedId("bookmark-2"),
      userId: studentId,
      threadId: seedId("thread-portfolio-tips"),
    },
  });

  await prisma.communityReport.upsert({
    where: { id: seedId("community-report-1") },
    update: {},
    create: {
      id: seedId("community-report-1"),
      reporterId: studentId,
      targetType: "THREAD",
      targetId: seedId("thread-welcome-mentor"),
      reason: "Possible duplicate of another pinned welcome thread — flagging for review.",
      status: "PENDING",
    },
  });

  // Mirror ReputationEvent + CommunityProfile the same way reputation.service.ts's
  // award() does (increment, not overwrite) so re-running the seed never
  // double-counts points for the same event.
  const reputationEvents = [
    { key: "rep-event-1", userId: studentId, points: 5, reason: "Started a discussion thread" },
    { key: "rep-event-2", userId: studentId, points: 5, reason: "Posted a question" },
    { key: "rep-event-3", userId: mentorId, points: 15, reason: "Answer accepted" },
    { key: "rep-event-4", userId: mentorId, points: 5, reason: "Replied to a thread" },
    { key: "rep-event-5", userId: studentId, points: 5, reason: "Posted a question" },
    { key: "rep-event-6", userId: studentId, points: 5, reason: "Started a discussion thread" },
    { key: "rep-event-7", userId: mentorId, points: 5, reason: "Replied to a thread" },
  ];
  for (const e of reputationEvents) {
    const existing = await prisma.reputationEvent.findUnique({ where: { id: seedId(e.key) } });
    if (existing) continue;
    await prisma.$transaction([
      prisma.reputationEvent.create({
        data: { id: seedId(e.key), userId: e.userId, points: e.points, reason: e.reason },
      }),
      prisma.communityProfile.upsert({
        where: { userId: e.userId },
        create: { userId: e.userId, reputationPoints: e.points },
        update: { reputationPoints: { increment: e.points } },
      }),
    ]);
  }
}

// ---------------------------------------------------------------------------
// Notifications — event types/categories match real conventions used
// elsewhere (e.g. "assignment.review_published"/"assignments" in
// reviewer.service.ts, "commerce.payment_success"/"commerce" in
// payments.service.ts) so seeded rows look like genuine system events.
// ---------------------------------------------------------------------------
async function seedNotifications(ids: DemoUserIds): Promise<void> {
  const { adminId, mentorId, studentId } = ids;

  interface NotificationSpec {
    key: string;
    userId: string;
    eventType: string;
    category: string;
    title: string;
    body: string;
    isRead: boolean;
    withDelivery?: boolean;
  }

  const notifications: NotificationSpec[] = [
    {
      key: "notif-student-review",
      userId: studentId,
      eventType: "assignment.review_published",
      category: "assignments",
      title: "Your submission was reviewed",
      body: "Your Portfolio Piece: Product Redesign submission has been reviewed — 21/25.",
      isRead: true,
      withDelivery: true,
    },
    {
      key: "notif-student-enrollment",
      userId: studentId,
      eventType: "enrollment.granted",
      category: "commerce",
      title: "You're enrolled!",
      body: "Your purchase of Pattern Making Masterclass is confirmed — start learning now.",
      isRead: true,
      withDelivery: true,
    },
    {
      key: "notif-student-reply",
      userId: studentId,
      eventType: "community.reply_received",
      category: "community",
      title: "New reply to your question",
      body: "Demo Mentor replied to your question about fabric weight.",
      isRead: false,
    },
    {
      key: "notif-student-progress-reminder",
      userId: studentId,
      eventType: "learning.progress_reminder",
      category: "learning",
      title: "Keep up the momentum!",
      body: "You're 75% through Pattern Making Masterclass — finish strong!",
      isRead: false,
    },
    {
      key: "notif-student-quiz-result-strong",
      userId: studentId,
      eventType: "quiz.attempt_scored",
      category: "assessment",
      title: "Quiz result: Pattern Construction Skills Quiz",
      body: "You scored 90% on Pattern Construction Skills Quiz — great work!",
      isRead: true,
      withDelivery: true,
    },
    {
      key: "notif-student-quiz-result-weak",
      userId: studentId,
      eventType: "quiz.attempt_scored",
      category: "assessment",
      title: "Quiz result: Design Aptitude Diagnostic Quiz",
      body: "You scored 37.5% on Design Aptitude Diagnostic Quiz — review the topic and try again.",
      isRead: false,
    },
    {
      key: "notif-student-mentor-feedback",
      userId: studentId,
      eventType: "mentoring.feedback_received",
      category: "mentoring",
      title: "New feedback from your mentor",
      body: "Demo Mentor left new feedback on your recent progress.",
      isRead: false,
    },
    {
      key: "notif-student-announcement",
      userId: studentId,
      eventType: "cms.announcement_published",
      category: "cms",
      title: "New announcement",
      body: "Welcome to Examora — new courses added!",
      isRead: true,
      withDelivery: true,
    },
    {
      key: "notif-student-recommendation",
      userId: studentId,
      eventType: "recommendation.course_suggested",
      category: "recommendations",
      title: "A course you might like",
      body: "Based on your progress, we recommend NIFT Entrance Preparation.",
      isRead: false,
    },
    {
      key: "notif-student-pending-assignment",
      userId: studentId,
      eventType: "assignment.pending_reminder",
      category: "assignments",
      title: "Assignment reminder",
      body: "Sketchbook Challenge: 10 Croquis Studies is still awaiting your submission.",
      isRead: false,
    },
    {
      key: "notif-mentor-assigned",
      userId: mentorId,
      eventType: "mentoring.student_assigned",
      category: "mentoring",
      title: "New student assigned",
      body: "Demo Student has been assigned to your mentee list.",
      isRead: true,
      withDelivery: true,
    },
    {
      key: "notif-mentor-submission",
      userId: mentorId,
      eventType: "assignment.submission_ready_for_review",
      category: "assignments",
      title: "Submission ready for review",
      body: "Demo Student submitted Portfolio Piece: Product Redesign for review.",
      isRead: false,
    },
    {
      key: "notif-admin-payment",
      userId: adminId,
      eventType: "commerce.payment_success",
      category: "commerce",
      title: "New order completed",
      body: "A payment for Pattern Making Masterclass was captured successfully.",
      isRead: false,
      withDelivery: true,
    },
    {
      key: "notif-admin-report",
      userId: adminId,
      eventType: "community.report_filed",
      category: "community",
      title: "New moderation report",
      body: "A community report was filed and is awaiting review.",
      isRead: false,
    },
  ];

  for (const n of notifications) {
    await prisma.notification.upsert({
      where: { id: seedId(n.key) },
      update: {},
      create: {
        id: seedId(n.key),
        userId: n.userId,
        eventType: n.eventType,
        category: n.category,
        title: n.title,
        body: n.body,
        isRead: n.isRead,
        readAt: n.isRead ? new Date() : null,
      },
    });

    if (n.withDelivery) {
      await prisma.notificationDelivery.upsert({
        where: { id: seedId(`delivery:${n.key}`) },
        update: {},
        create: {
          id: seedId(`delivery:${n.key}`),
          notificationId: seedId(n.key),
          channel: "IN_APP",
          status: "DELIVERED",
          attempts: 1,
          sentAt: new Date(),
          deliveredAt: new Date(),
        },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// CMS — a small amount of PUBLISHED content so the public pages
// (/pages/[slug], /faq, /announcements) and the admin CMS list views aren't
// empty. Banner's imageAssetId stays null deliberately (confirmed safe —
// cms-banners.service.ts guards every asset-usage touch with
// `if (item.imageAssetId)`), avoiding a fake storage reference.
// ---------------------------------------------------------------------------
async function seedCms(ids: DemoUserIds): Promise<void> {
  const { adminId } = ids;

  await prisma.cmsPage.upsert({
    where: { slug: "demo-about-examora" },
    update: {},
    create: {
      id: seedId("cms-page-about"),
      pageType: "STATIC",
      slug: "demo-about-examora",
      title: "About Examora",
      body: "Examora is a platform for design/fashion/architecture/aptitude entrance exam preparation and mentoring.",
      status: "PUBLISHED",
      publishedAt: new Date(),
      createdById: adminId,
    },
  });

  const faqs = [
    {
      key: "cms-faq-1",
      question: "How do I enroll in a course?",
      answer: "Browse the course catalog and click Enroll — free courses grant instant access.",
    },
    {
      key: "cms-faq-2",
      question: "How do quizzes work?",
      answer:
        "Quizzes are timed and auto-scored. Some quizzes use negative marking for wrong answers.",
    },
    {
      key: "cms-faq-3",
      question: "How do I contact my mentor?",
      answer:
        "Once assigned, your mentor is visible on your dashboard with a direct messaging option.",
    },
  ];
  for (const [index, f] of faqs.entries()) {
    await prisma.cmsFaqItem.upsert({
      where: { id: seedId(f.key) },
      update: {},
      create: {
        id: seedId(f.key),
        question: f.question,
        answer: f.answer,
        position: index,
        status: "PUBLISHED",
        publishedAt: new Date(),
        createdById: adminId,
      },
    });
  }

  await prisma.cmsAnnouncement.upsert({
    where: { id: seedId("cms-announcement-1") },
    update: {},
    create: {
      id: seedId("cms-announcement-1"),
      title: "Welcome to Examora — new courses added!",
      body: "We've just added Pattern Making Masterclass and Architectural Drafting Basics to the catalog.",
      status: "PUBLISHED",
      publishedAt: new Date(),
      createdById: adminId,
    },
  });

  await prisma.cmsBanner.upsert({
    where: { id: seedId("cms-banner-1") },
    update: {},
    create: {
      id: seedId("cms-banner-1"),
      title: "Explore our new courses",
      linkUrl: "/courses",
      placement: "HOMEPAGE_TOP",
      status: "PUBLISHED",
      publishedAt: new Date(),
      createdById: adminId,
    },
  });
}

// ---------------------------------------------------------------------------
// Commerce — real Order -> Payment -> Invoice -> Enrollment chains
// (ADR-0018's actual purchase relationships, not a shortcut) for the two
// paid courses the demo student owns, demonstrating the purchase flow
// without calling the real Razorpay gateway (these are just DB rows for
// display purposes; the checkout code path that talks to Razorpay is
// untouched). A third, PENDING order for a course the student does NOT yet
// own (Order.status=PENDING never creates an Enrollment — Enrollment model
// comment, schema.prisma) shows a realistic mixed-status Orders list and an
// "abandoned checkout" for the same course still visible as ownable in the
// paid-course catalog.
// ---------------------------------------------------------------------------
async function seedCommerce(ids: DemoUserIds): Promise<void> {
  const { adminId, studentId } = ids;

  interface PaidPurchaseSpec {
    key: string;
    courseKey: string;
    subtotal: number;
    couponCode?: string;
    invoiceNumber: string;
  }

  const purchases: PaidPurchaseSpec[] = [
    {
      key: "pattern-making",
      courseKey: "course-pattern-making",
      subtotal: 2999,
      couponCode: "DEMOWELCOME10",
      invoiceNumber: "DEMO-INV-00001",
    },
    {
      key: "nid-entrance-prep",
      courseKey: "course-nid-entrance-prep",
      subtotal: 6999,
      invoiceNumber: "DEMO-INV-00002",
    },
  ];

  await prisma.coupon.upsert({
    where: { code: "DEMOWELCOME10" },
    update: {},
    create: {
      id: seedId("coupon-welcome10"),
      code: "DEMOWELCOME10",
      discountType: "PERCENTAGE",
      discountValue: "10",
      redemptionCount: 1,
      isActive: true,
      createdById: adminId,
    },
  });

  for (const purchase of purchases) {
    const courseId = seedId(purchase.courseKey);
    const orderId = seedId(`order-student-${purchase.key}-paid`);
    const discount = purchase.couponCode ? Math.round(purchase.subtotal * 0.1 * 100) / 100 : 0;
    const total = purchase.subtotal - discount;

    await prisma.order.upsert({
      where: { id: orderId },
      update: {},
      create: {
        id: orderId,
        userId: studentId,
        courseId,
        couponId: purchase.couponCode ? seedId("coupon-welcome10") : null,
        status: "PAID",
        subtotalAmount: purchase.subtotal,
        discountAmount: discount,
        totalAmount: total,
      },
    });

    await prisma.payment.upsert({
      where: { gatewayPaymentId: `demo_pay_${orderId.slice(0, 12)}` },
      update: {},
      create: {
        id: seedId(`payment-student-${purchase.key}`),
        orderId,
        gateway: "RAZORPAY",
        gatewayOrderId: `demo_order_${orderId.slice(0, 12)}`,
        gatewayPaymentId: `demo_pay_${orderId.slice(0, 12)}`,
        status: "CAPTURED",
        amount: total,
        verifiedAt: new Date(),
      },
    });

    await prisma.invoice.upsert({
      where: { orderId },
      update: {},
      create: {
        id: seedId(`invoice-student-${purchase.key}`),
        orderId,
        invoiceNumber: purchase.invoiceNumber,
        amount: total,
      },
    });

    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: studentId, courseId } },
      update: {},
      create: {
        userId: studentId,
        courseId,
        orderId,
        status: "ACTIVE",
        source: "PURCHASE",
        enrolledAt: new Date(),
      },
    });
  }

  // An unfinished checkout attempt for a course the student does NOT yet
  // own — realistic "abandoned cart" row for the admin Orders list and the
  // student's own order history, with no payment/enrollment attached.
  const pendingCourseId = seedId("course-design-aptitude-masterclass");
  const pendingOrderId = seedId("order-student-design-aptitude-masterclass-pending");
  await prisma.order.upsert({
    where: { id: pendingOrderId },
    update: {},
    create: {
      id: pendingOrderId,
      userId: studentId,
      courseId: pendingCourseId,
      status: "PENDING",
      subtotalAmount: 3499,
      discountAmount: 0,
      totalAmount: 3499,
    },
  });
}

async function main(): Promise<void> {
  const roleRows = await Promise.all(
    ROLES.map((name) => prisma.role.upsert({ where: { name }, update: {}, create: { name } })),
  );
  const roleIdByName = new Map(roleRows.map((role) => [role.name, role.id]));

  const permissionRows = await Promise.all(
    PERMISSION_CODES.map((code) =>
      prisma.permission.upsert({ where: { code }, update: {}, create: { code } }),
    ),
  );
  const permissionIdByCode = new Map(
    permissionRows.map((permission) => [permission.code, permission.id]),
  );

  for (const roleName of ROLES) {
    const roleId = roleIdByName.get(roleName);
    if (!roleId) continue;

    for (const code of ROLE_PERMISSIONS[roleName]) {
      const permissionId = permissionIdByCode.get(code);
      if (!permissionId) continue;

      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId },
      });
    }
  }

  // Demo/dev accounts and demo content — identical for Docker and native
  // Postgres, since both run this same seed via the root `db:migrate`
  // script. Never runs in production: a real deployment must never receive
  // publicly-documented credentials or mock data.
  let demoUsersSeeded = 0;
  if (process.env.NODE_ENV !== "production") {
    const password = process.env.DEV_SEED_PASSWORD || "a-strong-password-123";
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    const userIdByEmail = new Map<string, string>();
    for (const demo of DEMO_USERS) {
      const user = await prisma.user.upsert({
        where: { email: demo.email },
        update: { passwordHash, firstName: demo.firstName, lastName: demo.lastName },
        create: {
          email: demo.email,
          passwordHash,
          firstName: demo.firstName,
          lastName: demo.lastName,
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
        },
      });
      userIdByEmail.set(demo.email, user.id);

      for (const roleName of demo.roles) {
        const roleId = roleIdByName.get(roleName);
        if (!roleId) continue;

        await prisma.userRole.upsert({
          where: { userId_roleId: { userId: user.id, roleId } },
          update: {},
          create: { userId: user.id, roleId },
        });
      }

      if (demo.createMentorProfile) {
        await prisma.mentorProfile.upsert({
          where: { userId: user.id },
          update: {},
          create: {
            userId: user.id,
            bio: "Seeded local-development mentor account.",
            specialization: "General",
            maxStudents: 10,
          },
        });
      }

      demoUsersSeeded++;
    }

    const demoIds: DemoUserIds = {
      adminId: userIdByEmail.get("admin@examora.test")!,
      mentorId: userIdByEmail.get("mentor@examora.test")!,
      studentId: userIdByEmail.get("student@examora.test")!,
    };

    await seedCourseContent(demoIds);
    await seedAssessments(demoIds);
    await seedAssignments(demoIds);
    await seedMentorWorkspace(demoIds);
    await seedCommunity(demoIds);
    await seedNotifications(demoIds);
    await seedCms(demoIds);
    await seedCommerce(demoIds);
  }

  // eslint-disable-next-line no-console -- seed script CLI output, not application logging
  console.log(
    `Seeded ${roleRows.length} roles, ${permissionRows.length} permissions, and role-permission mappings.` +
      (demoUsersSeeded > 0
        ? ` Seeded ${demoUsersSeeded} local-development demo accounts plus realistic demo content across ` +
          `courses/assessments/assignments/mentoring/community/notifications/CMS/commerce (skipped in production).`
        : " Skipped local-development demo accounts and demo content (NODE_ENV=production)."),
  );
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
