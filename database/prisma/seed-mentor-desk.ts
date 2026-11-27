/**
 * Mentor module demo data (idempotent): a second batch the demo mentor covers,
 * a batch they must NOT see, five weeks of attendance, doubts, the course quiz
 * calendar, a mock test published to the evening batch, reports in every
 * state, shout-outs, announcements and pending approval requests.
 */
import type { PrismaClient } from "../generated/client/index.js";
import { deterministicUuid } from "./seed-id.js";

const sid = (label: string) => deterministicUuid("examora-mentor-desk-seed", label);
const DAY = 86_400_000;

function todayIndia(): Date {
  const ist = new Date(Date.now() + 330 * 60_000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
}
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Stable 0–99 from a string. */
function roll(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h) % 100;
}

type Slot = { day: number; start: string; end: string };

async function upsertBatch(
  prisma: PrismaClient,
  id: string,
  data: {
    name: string;
    batch: string;
    courseId: string;
    mode: string;
    schedule: Slot[];
    location?: string;
    meetingUrl?: string;
  },
) {
  const today = todayIndia();
  await prisma.cohort.upsert({
    where: { id },
    create: {
      id,
      ...data,
      startsOn: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 2, 1)),
      endsOn: new Date(Date.UTC(today.getUTCFullYear() + 1, 4, 31)),
    },
    update: {},
  });
}

async function setMentors(
  prisma: PrismaClient,
  cohortId: string,
  primaryId: string,
  cover?: { mentorId: string; endsOn: Date },
) {
  await prisma.cohortMentor.deleteMany({ where: { cohortId } });
  await prisma.cohortMentor.createMany({
    data: [
      { cohortId, mentorId: primaryId, role: "PRIMARY" },
      ...(cover
        ? [{ cohortId, mentorId: cover.mentorId, role: "COVER", endsOn: cover.endsOn }]
        : []),
    ],
  });
}

/** Timetable classes for [from, to] plus attendance for all but the most recent past class. */
async function seedAttendance(
  prisma: PrismaClient,
  cohortId: string,
  slots: Slot[],
  members: string[],
  takenById: string,
  special: { atRisk?: string; low?: string; star?: string },
) {
  const today = todayIndia();
  const from = addDays(today, -35);
  const rows: { cohortId: string; date: Date; start: string; end: string; mode: string }[] = [];
  for (let d = from; d <= addDays(today, 7); d = addDays(d, 1)) {
    for (const s of slots) {
      if (s.day === d.getUTCDay())
        rows.push({ cohortId, date: d, start: s.start, end: s.end, mode: "OFFLINE" });
    }
  }
  await prisma.classSession.createMany({ data: rows, skipDuplicates: true });
  const past = await prisma.classSession.findMany({
    where: { cohortId, date: { gte: from, lt: today } },
    orderBy: [{ date: "asc" }, { start: "asc" }],
    select: { id: true, date: true },
  });
  const toMark = past.slice(0, -1); // the latest class is left for the mentor to mark
  const last3 = new Set(toMark.slice(-3).map((s) => s.id));
  const records: { sessionId: string; userId: string; status: string }[] = [];
  const topics = [
    "Perspective drawing",
    "Colour theory",
    "Visual analogies",
    "Memory drawing",
    "Design thinking",
    "Product sketching",
  ];
  for (const [i, s] of toMark.entries()) {
    for (const userId of members) {
      const r = roll(`${userId}:${iso(s.date)}`);
      let status = r < 82 ? "PRESENT" : r < 88 ? "LATE" : r < 96 ? "ABSENT" : "EXCUSED";
      if (userId === special.star) status = r < 95 ? "PRESENT" : "LATE";
      if (userId === special.low) status = r < 50 ? "PRESENT" : r < 60 ? "LATE" : "ABSENT";
      if (userId === special.atRisk && last3.has(s.id)) status = "ABSENT";
      records.push({ sessionId: s.id, userId, status });
    }
    await prisma.classSession.update({
      where: { id: s.id },
      data: {
        takenById,
        takenAt: new Date(s.date.getTime() + 20 * 3_600_000),
        topic: topics[i % topics.length],
      },
    });
  }
  await prisma.attendanceRecord.createMany({ data: records, skipDuplicates: true });
  return toMark.length;
}

export async function seedMentorDesk(
  prisma: PrismaClient,
  ids: { studentId: string; mentorId: string; adminId: string },
): Promise<string> {
  const nid = await prisma.course.findFirst({
    where: { title: "NID UG | UCEED", deletedAt: null },
    select: { id: true },
  });
  const uceed = await prisma.course.findFirst({
    where: { title: "UCEED Complete Preparation", deletedAt: null },
    select: { id: true },
  });
  if (!nid) return "mentor desk skipped (no NID UG | UCEED course)";
  const otherMentors = await prisma.user.findMany({
    where: {
      email: { endsWith: "@bulk.examora.test" },
      roles: { some: { role: { name: "MENTOR" } } },
    },
    orderBy: { email: "asc" },
    select: { id: true },
    take: 2,
  });
  const karthik = otherMentors[0]?.id ?? ids.adminId;
  const riya = otherMentors[1]?.id ?? ids.adminId;
  const today = todayIndia();

  // ---- batches
  const evening = deterministicUuid("examora-student-module-seed", "batch:nid-evening");
  const eveningSlots: Slot[] = [
    { day: 1, start: "18:00", end: "19:30" },
    { day: 3, start: "18:00", end: "19:30" },
    { day: 5, start: "18:00", end: "19:30" },
  ];
  await setMentors(prisma, evening, ids.mentorId);

  const weekend = sid("batch:nid-weekend");
  const weekendSlots: Slot[] = [
    { day: 6, start: "10:00", end: "12:00" },
    { day: 0, start: "10:00", end: "12:00" },
  ];
  await upsertBatch(prisma, weekend, {
    name: "NID UG | UCEED – Weekend",
    batch: "Weekend",
    courseId: nid.id,
    mode: "OFFLINE",
    schedule: weekendSlots,
    location: "Studio 1, Examora Pune centre",
  });
  await setMentors(prisma, weekend, karthik, {
    mentorId: ids.mentorId,
    endsOn: addDays(today, 10),
  });

  const bulk = await prisma.user.findMany({
    where: {
      email: { endsWith: "@bulk.examora.test" },
      roles: { some: { role: { name: "STUDENT" } } },
    },
    orderBy: { email: "asc" },
    select: { id: true },
    take: 60,
  });
  const eveningMembers = (
    await prisma.cohortMember.findMany({
      where: { cohortId: evening },
      orderBy: { user: { email: "asc" } },
      select: { userId: true },
    })
  ).map((m) => m.userId);
  const weekendMembers = bulk.slice(25, 40).map((u) => u.id);
  await prisma.cohortMember.createMany({
    data: weekendMembers.map((userId) => ({ cohortId: weekend, userId })),
    skipDuplicates: true,
  });

  if (uceed) {
    const morning = sid("batch:uceed-morning");
    await upsertBatch(prisma, morning, {
      name: "UCEED Complete – Morning (online)",
      batch: "Morning",
      courseId: uceed.id,
      mode: "ONLINE",
      schedule: [
        { day: 2, start: "07:00", end: "08:00" },
        { day: 4, start: "07:00", end: "08:00" },
      ],
      meetingUrl: "https://meet.example.com/examora-uceed-morning",
    });
    await setMentors(prisma, morning, riya);
    await prisma.cohortMember.createMany({
      data: bulk.slice(40, 55).map((u) => ({ cohortId: morning, userId: u.id })),
      skipDuplicates: true,
    });
  }

  // ---- attendance
  const classmates = eveningMembers.filter((id) => id !== ids.studentId);
  const atRisk = classmates[2];
  const low = classmates[4];
  const marked =
    (await seedAttendance(prisma, evening, eveningSlots, eveningMembers, ids.mentorId, {
      atRisk,
      low,
      star: ids.studentId,
    })) + (await seedAttendance(prisma, weekend, weekendSlots, weekendMembers, karthik, {}));

  // ---- questions of the course
  const singles = await prisma.question.findMany({
    where: {
      deletedAt: null,
      type: "SINGLE_CHOICE",
      OR: [{ subject: { courseId: nid.id } }, { topic: { subject: { courseId: nid.id } } }],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
    take: 40,
  });
  const qids = singles.map((q) => q.id);

  // ---- doubts (some answered by the mentor, most open)
  const doubtTexts = [
    "Why is the answer B? I thought the vanishing point would be on the horizon line.",
    "Can someone explain how to count the cubes in this figure? I keep getting 23.",
    "Is there a quick trick for these colour-wheel questions?",
    "I don't understand why the mirror image flips left-right but not top-bottom.",
    "How much time should I spend on this kind of question in the real exam?",
    "Option C also looks right to me. What makes it wrong?",
  ];
  let doubts = 0;
  for (const [i, body] of doubtTexts.entries()) {
    const questionId = qids[i * 3];
    const userId = i === 5 ? (bulk[30]?.id ?? classmates[0]) : (classmates[i] ?? classmates[0]);
    if (!questionId || !userId) continue;
    const id = sid(`doubt:${i}`);
    const created = addDays(new Date(), -(6 - i));
    await prisma.questionDoubt.upsert({
      where: { id },
      create: {
        id,
        questionId,
        userId,
        body,
        createdAt: created,
        ...(i < 2 ? { resolvedAt: addDays(created, 0.2), resolvedById: ids.mentorId } : {}),
      },
      update: {},
    });
    if (i < 2) {
      const rid = sid(`doubt-reply:${i}`);
      await prisma.questionDoubt.upsert({
        where: { id: rid },
        create: {
          id: rid,
          questionId,
          userId: ids.mentorId,
          parentId: id,
          body:
            i === 0
              ? "Good question! In one-point perspective all receding lines meet at **one** vanishing point on the horizon. Here the box is turned, so it's two-point perspective: look for two points on the same horizon line."
              : "Count layer by layer: bottom layer 3×3 = 9, middle 2×3 = 6, top 1×3 = 3, so 18 visible + 5 hidden ones in the back = **23**. Your count is right!",
          createdAt: addDays(created, 0.2),
        },
        update: {},
      });
    }
    doubts++;
  }

  // ---- daily quiz calendar (tomorrow onwards, with gaps)
  const plan = [
    { day: 1, by: ids.mentorId, title: "Colour theory sprint" },
    { day: 2, by: karthik, title: "Perspective basics" },
    { day: 4, by: ids.mentorId, title: "Visual reasoning warm-up" },
  ];
  for (const [i, p] of plan.entries()) {
    const date = addDays(today, p.day);
    const questionIds = qids.slice(i * 10, i * 10 + 10);
    if (questionIds.length < 5) continue;
    await prisma.dailyQuizSchedule.upsert({
      where: { courseId_date: { courseId: nid.id, date } },
      create: { courseId: nid.id, date, title: p.title, questionIds, createdById: p.by },
      update: {},
    });
  }

  // ---- mock test published to the evening batch
  const mockCat = await prisma.practiceCategory.findFirst({
    where: { courseId: nid.id, title: "Mock tests" },
    select: { id: true },
  });
  const subject = await prisma.subject.findFirst({
    where: { courseId: nid.id, deletedAt: null },
    orderBy: { position: "asc" },
    select: { id: true },
  });
  const mockId = sid("quiz:evening-mock-1");
  await prisma.quiz.upsert({
    where: { id: mockId },
    create: {
      id: mockId,
      title: "Evening Batch – Mock Test 1 (Part A)",
      slug: "evening-batch-mock-test-1",
      description: "Timed Part A practice set for the evening batch. Read each question carefully.",
      status: "PUBLISHED",
      publishedAt: addDays(new Date(), -3),
      timeLimitMinutes: 30,
      subjectId: subject?.id ?? null,
      practiceCategoryId: mockCat?.id ?? null,
      createdById: ids.mentorId,
      xpReward: 40,
      position: 99,
    },
    update: {},
  });
  if ((await prisma.quizQuestion.count({ where: { quizId: mockId } })) === 0) {
    await prisma.quizQuestion.createMany({
      data: qids
        .slice(10, 25)
        .map((questionId, i) => ({ quizId: mockId, questionId, marks: 2, position: i })),
    });
  }
  await prisma.quizCohort.createMany({
    data: [{ quizId: mockId, cohortId: evening }],
    skipDuplicates: true,
  });

  // ---- assignment submissions route to the batch mentor
  await prisma.assignmentSubmission.updateMany({
    where: { studentId: { in: eveningMembers }, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
    data: { reviewerId: ids.mentorId },
  });

  // ---- reports in every state
  const month = iso(today).slice(0, 7);
  const prev = iso(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1))).slice(
    0,
    7,
  );
  const attOf = async (userId: string) => {
    const rec = await prisma.attendanceRecord.findMany({
      where: { userId, session: { cohortId: evening } },
      select: { status: true },
    });
    const held = rec.filter((r) => r.status !== "EXCUSED").length;
    const att = rec.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
    return {
      attendancePercent: held ? Math.round((att / held) * 100) : null,
      classesHeld: held,
      absences: rec.filter((r) => r.status === "ABSENT").length,
    };
  };
  const reports = [
    {
      key: "demo-month",
      studentId: ids.studentId,
      kind: "MONTHLY",
      period: month,
      status: "SUBMITTED",
      remarks:
        "Consistent and attentive in class. Her perspective sketches have improved a lot; next step is speed in Part A (aim for under 45 s per question). Keep up the daily quiz streak.",
      adminNote: null,
    },
    {
      key: "c1-prev",
      studentId: classmates[0],
      kind: "MONTHLY",
      period: prev,
      status: "APPROVED",
      remarks:
        "Good month. Strong in visual reasoning; needs more practice on colour theory questions.",
      adminNote: "Shared with the parent on WhatsApp.",
    },
    {
      key: "c2-month",
      studentId: classmates[1],
      kind: "MONTHLY",
      period: month,
      status: "RETURNED",
      remarks: "Doing fine overall. Attendance is good.",
      adminNote: "Please add a line about the Mock Test 1 result and one thing to improve.",
    },
    {
      key: "atrisk-alert",
      studentId: atRisk,
      kind: "ALERT",
      period: iso(today),
      status: "SUBMITTED",
      remarks:
        "Absent for the last three classes without informing. Called once, no answer. Requesting the office to contact the parent this week.",
      adminNote: null,
    },
    {
      key: "c4-draft",
      studentId: classmates[3],
      kind: "MONTHLY",
      period: month,
      status: "DRAFT",
      remarks: "",
      adminNote: null,
    },
  ];
  for (const r of reports) {
    if (!r.studentId) continue;
    const id = sid(`report:${r.key}`);
    const summary = {
      ...(await attOf(r.studentId)),
      quizzesTaken: 0,
      avgQuizPercent: null,
      dailyQuizDays: 0,
      sketchesMarked: 0,
      avgSketchPercent: null,
      assignmentsSubmitted: 0,
      assignmentsMissing: 0,
      lessonsCompleted: 0,
      weakTopics: [],
    };
    await prisma.progressReport.upsert({
      where: { id },
      create: {
        id,
        studentId: r.studentId,
        mentorId: ids.mentorId,
        cohortId: evening,
        kind: r.kind,
        period: r.period,
        summary,
        remarks: r.remarks,
        status: r.status,
        adminNote: r.adminNote,
        submittedAt: r.status === "DRAFT" ? null : addDays(new Date(), -2),
        decidedAt:
          r.status === "APPROVED" || r.status === "RETURNED" ? addDays(new Date(), -1) : null,
        decidedById: r.status === "APPROVED" || r.status === "RETURNED" ? ids.adminId : null,
      },
      update: {},
    });
  }

  // ---- shout-outs
  const shouts = [
    {
      key: "demo-sketch",
      studentId: ids.studentId,
      badge: "best-sketch",
      note: "Your two-point perspective room was the best in the batch!",
      ago: 2,
    },
    {
      key: "c6-improved",
      studentId: classmates[5],
      badge: "most-improved",
      note: "Mock score up from 48% to 71%. Brilliant effort.",
      ago: 1,
    },
  ];
  for (const s of shouts) {
    if (!s.studentId) continue;
    const id = sid(`shout:${s.key}`);
    await prisma.mentorShoutout.upsert({
      where: { id },
      create: {
        id,
        studentId: s.studentId,
        mentorId: ids.mentorId,
        badge: s.badge,
        note: s.note,
        createdAt: addDays(new Date(), -s.ago),
      },
      update: {},
    });
  }

  // ---- announcements
  const notices = [
    {
      key: "mock-sunday",
      cohortId: evening,
      authorId: ids.mentorId,
      title: "Mock Test 1 is live",
      body: "Mock Test 1 (Part A, 30 minutes) is on your Practice page. Finish it before Sunday night so we can discuss it in Monday's class.",
      ago: 2,
    },
    {
      key: "a3-sheets",
      cohortId: evening,
      authorId: ids.mentorId,
      title: "Bring A3 sheets on Monday",
      body: "Perspective drawing practice: bring 2 A3 sheets, 2B and 4B pencils and an eraser.",
      ago: 0,
    },
    {
      key: "weekend-studio",
      cohortId: weekend,
      authorId: karthik,
      title: "Studio class moves to 10:30 this Saturday",
      body: "This Saturday only, class starts at 10:30 because of the building maintenance.",
      ago: 1,
    },
  ];
  for (const n of notices) {
    const id = sid(`notice:${n.key}`);
    await prisma.batchAnnouncement.upsert({
      where: { id },
      create: {
        id,
        cohortId: n.cohortId,
        authorId: n.authorId,
        title: n.title,
        body: n.body,
        createdAt: addDays(new Date(), -n.ago),
      },
      update: {},
    });
  }

  // ---- approval requests (content change, publish, new student, one sent back)
  const lesson = await prisma.lesson.findFirst({
    where: {
      status: "PUBLISHED",
      deletedAt: null,
      module: { topic: { subject: { courseId: nid.id } } },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true },
  });
  const firstSubject = subject?.id;
  const draftTopicId = sid("topic:isometric-drills");
  if (firstSubject) {
    await prisma.topic.upsert({
      where: { id: draftTopicId },
      create: {
        id: draftTopicId,
        subjectId: firstSubject,
        title: "Isometric drawing drills",
        slug: "isometric-drawing-drills",
        description: "Ten short drills to get comfortable with isometric views before the mock.",
        status: "DRAFT",
        position: 98,
        createdById: ids.mentorId,
      },
      update: {},
    });
  }
  const requests = [
    lesson && {
      key: "change-lesson",
      kind: "CONTENT_CHANGE",
      targetType: "lesson",
      targetId: lesson.id,
      targetLabel: lesson.title,
      payload: {
        title: `${lesson.title} (with worked examples)`,
        description: "Adds three worked examples from the 2024 paper.",
      },
      status: "PENDING",
    },
    firstSubject && {
      key: "publish-topic",
      kind: "CONTENT_PUBLISH",
      targetType: "topic",
      targetId: draftTopicId,
      targetLabel: "Isometric drawing drills",
      payload: {},
      note: "Ready for students; used in Wednesday's class.",
      status: "PENDING",
    },
    {
      key: "new-student",
      kind: "NEW_STUDENT",
      targetType: "batch",
      targetId: evening,
      targetLabel: "aarav.mehta@example.com",
      payload: {
        name: "Aarav Mehta",
        email: "aarav.mehta@example.com",
        phone: "9876543210",
        cohortName: "NID UG | UCEED – Evening",
      },
      note: "Joined the offline class this week; parent paid at the centre.",
      status: "PENDING",
    },
    lesson && {
      key: "change-rejected",
      kind: "CONTENT_CHANGE",
      targetType: "lesson",
      targetId: lesson.id,
      targetLabel: lesson.title,
      payload: { title: "Lesson 1" },
      status: "REJECTED",
      decisionNote: "The new title is too vague; keep the descriptive one.",
    },
  ].filter(Boolean) as {
    key: string;
    kind: string;
    targetType: string;
    targetId: string;
    targetLabel: string;
    payload: object;
    note?: string;
    status: string;
    decisionNote?: string;
  }[];
  for (const r of requests) {
    const id = sid(`request:${r.key}`);
    await prisma.staffRequest.upsert({
      where: { id },
      create: {
        id,
        kind: r.kind,
        targetType: r.targetType,
        targetId: r.targetId,
        targetLabel: r.targetLabel,
        payload: r.payload,
        note: r.note ?? null,
        status: r.status,
        requestedById: ids.mentorId,
        decidedById: r.status === "PENDING" ? null : ids.adminId,
        decisionNote: r.decisionNote ?? null,
        decidedAt: r.status === "PENDING" ? null : addDays(new Date(), -3),
        createdAt: addDays(new Date(), r.status === "PENDING" ? -1 : -4),
      },
      update: {},
    });
  }

  return `mentor desk: 3 batches, ${marked} classes marked, ${doubts} doubts, calendar, mock test, ${reports.length} reports, shout-outs, notices, ${requests.length} requests`;
}
