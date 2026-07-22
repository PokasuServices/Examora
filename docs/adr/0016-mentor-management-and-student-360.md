# ADR-0016: Mentor Management, Student 360, and Mentor Workflow

Status: Accepted
Date: 2026-07-22
Deciders: Engineering (Sprint 6)

## Context

Sprint 6 ("Mentor Management") gives admins a way to manage mentors and assign them to students,
gives mentors a workflow for managing their assigned students (notes, tasks, feedback, meetings,
and reviewing progress/quizzes/assignments), and gives both a "Student 360" aggregated view of a
student's learning progress, quiz history, assignment history, and activity timeline
(FR-MENTOR-01/02/03, DESIGN-03 §4). The `MENTOR` and `REVIEWER` roles already exist (ADR-0015,
Sprint 5), currently with identical permissions (`REVIEWER_PERMISSION_CODES`).

Per the Sprint 6 kickoff instruction ("review all existing APIs and services before creating new
ones; reuse existing services wherever possible and avoid duplicating business logic"), this sprint
is designed around composing existing services (`ProgressService`, `AdminQuizAttemptsService`,
`SubmissionsService`, `UsersService`) rather than re-implementing progress/scoring/submission
queries. See D-48/D-49 for the sprint resequencing and reuse inventory this ADR builds on.

## Decisions

**Mentor and Reviewer diverge in permissions for the first time.** Both roles previously got
identical `REVIEWER_PERMISSION_CODES`. This sprint adds `mentor:workflow` to `MENTOR` only (a new
`MENTOR_PERMISSION_CODES = [...REVIEWER_PERMISSION_CODES, "mentor:workflow"]`) — a plain `REVIEWER`
reviews creative-assignment submissions but does not get a mentee caseload, notes, tasks, or
meetings. `mentor:manage` (admin CRUD on mentor profiles, assignment, workload) stays
ADMINISTRATOR-only, mirroring the `assignment:manage`/`assignment:review` split.

**A mentor's "profile" is a thin extension of `User`, not a parallel identity.** `MentorProfile` is
a 1:1 table (`userId` unique FK) holding only what doesn't belong on the core identity model: `bio`,
`specialization`, and `maxStudents` (workload capacity). Name/email/phone/status stay on `User` —
reused via `UsersService.findByIdWithRoles`, not duplicated. A `MentorProfile` row only exists for
users who actually hold the MENTOR role; creating one does not itself grant the role (RBAC role
assignment stays on the existing `PATCH /admin/users/:id/roles`, unchanged).

**Mentor↔student assignment is a history-preserving join table, not a nullable FK.** A direct
`currentMentorId` field on `User` (mirroring `AssignmentSubmission.reviewerId`) was considered and
rejected: unlike a submission (which has exactly one reviewer for its whole lifetime), a student's
mentor can change over time and the platform needs "who was this student's mentor, and when" for
Student 360's activity timeline and audit purposes. `MentorAssignment` rows are never edited or
deleted — reassigning a student sets `unassignedAt = now()` on the current active row (the one with
`unassignedAt IS NULL`) and inserts a new one, the same append-and-supersede shape as
`AssignmentSubmission` versioning (ADR-0015) and `QuizAttempt` history (ADR-0014). Enforcing "at most
one active mentor per student" is application logic (`MentorAssignmentService.assign` checks for an
existing active row before creating a new one), not a DB constraint — consistent with how this
codebase already enforces domain invariants in the service layer rather than via partial unique
indexes (see D-07's raw-SQL-is-an-exception stance).

**Student 360 is a read-only aggregator over four existing services, not a new data model.**
`Student360Service` composes, for a given `studentId`: `UsersService.findByIdWithRoles` (Student
Profile), `ProgressService.getDashboard`/`getCourseProgress` (Learning Progress — already accepts an
explicit `userId` param, no admin-only variant needed), `AdminQuizAttemptsService.list({ userId })`
(Quiz History — already supports an admin-side `userId` filter), and
`SubmissionsService.listHistory(studentId)` (Assignment History — already takes the target
student's id as its first param, since the student-facing history endpoint was written that way in
Sprint 5). None of these four services needed new query logic, only a new `exports:` entry on their
owning module so `MentoringModule` can inject them. The **Activity Timeline** is the one genuinely
new piece: a thin merge-and-sort over lesson completions, quiz attempts, assignment submissions, and
mentor notes/tasks/meetings into one reverse-chronological feed — an aggregation, not a duplication,
of each source's own business logic.

**"Assignment Review" and "Quiz Review" in the Mentor Workflow scope are not new write paths.**
Assignment review already exists in full (Sprint 5's `ReviewerController`/`ReviewerService` — a
mentor holding `assignment:review` scores rubrics and publishes decisions today; Sprint 6 adds
nothing here beyond linking to it from the mentor dashboard). Quiz review is `Student360Service`
surfacing `AdminQuizAttemptsService`'s existing per-attempt detail (already includes the full
question/answer breakdown for admin monitoring) to a mentor for one of their assigned students, via
Student 360 — not a new quiz-grading capability. "Progress Review" is the Student 360 Learning
Progress section, same reasoning.

**Every mentor-workflow endpoint (Student 360, notes, tasks, feedback, meetings) is gated by the
single `mentor:workflow` permission, with ownership enforced in the service layer, not the
decorator.** `RequirePermissions` is AND-only (every listed code must be present) — there is no
"any of these codes" mode — so a shared mentor-or-admin endpoint cannot list both `mentor:manage`
and `mentor:workflow`. Since `ADMINISTRATOR` already holds every permission code (`seed.ts`'s
`[...PERMISSION_CODES]`), gating with `mentor:workflow` alone already admits admins. Each service
method then calls `assertAssignedOrAdmin(actor, studentId)`: passes if the actor's roles include
`ADMINISTRATOR`, or if `MentorAssignmentService` says the actor is the student's current active
mentor; otherwise `ForbiddenException`. This mirrors `ReviewerService`'s existing
"assigned-reviewer-or-throw" ownership check (Sprint 5), applied to the mentor↔student relationship
instead of the reviewer↔submission one.

**Notes, Tasks, Feedback, and Meetings are four small, independent tables**, not one polymorphic
"mentor activity" table. Each has a distinct shape (a task has a due date and status; a meeting has
an occurred-at and duration; a note and a piece of feedback are both freeform text but a note is
private-forever while feedback is the thing a mentor explicitly shares) and distinct
read/write patterns, so a shared table would need nullable columns for whichever fields don't apply
to a given row — the same reasoning that already keeps `AssignmentComment` separate from
`RubricScore` (ADR-0015). All four share the same authorization path
(`assertAssignedOrAdmin`) and audit-logging pattern (`AuditService.record`, unchanged from every
prior sprint).

**Mentor Dashboard (mentor-facing) and Admin Mentor Dashboard (admin-facing) are two different
endpoints that share one workload computation, not one endpoint with a role switch.** A mentor's own
dashboard shows their assigned students + pending tasks + recent meetings, scoped to `actor.id`. The
admin's mentor dashboard shows every mentor's workload (assigned-student count vs. `maxStudents`)
for capacity planning. Both call the same `MentorAssignmentService.getWorkload(mentorId)` helper;
the controllers differ in whose id they pass and their permission gate (`mentor:workflow` vs.
`mentor:manage`).

## Consequences

- `MentoringModule` takes on cross-module dependencies for the first time in this codebase —
  `LearningModule`, `AssessmentModule`, and `AssignmentsModule` each need a new `exports:` array
  (previously empty/absent) so their services can be injected elsewhere. This is a one-line change
  per module with no behavior change to any existing endpoint.
- Student 360's Activity Timeline reads from five sources per request (lessons, quizzes,
  submissions, notes/tasks/meetings) with no caching — acceptable at current scale (mirrors
  `ProgressService.getDashboard`'s existing multi-query-per-request shape from Sprint 3), revisit if
  profiling shows it's a hot path once real mentor caseloads exist.
- `MentorAssignment`'s history-table shape means "who is this student's current mentor" is always a
  query (`WHERE studentId = ? AND unassignedAt IS NULL`), never a stored denormalized field — same
  trade-off already accepted for `AssignmentSubmission`'s "current version" query.

## Alternatives Considered

- **`currentMentorId` as a direct nullable FK on `User`**: rejected — loses assignment history,
  which Student 360's activity timeline and admin oversight both need ("who was this student's
  mentor last month" is a real question a reassignment workflow raises).
- **A single polymorphic `MentorActivity` table** for notes/tasks/feedback/meetings: rejected as
  premature normalization — four distinct shapes with four distinct query patterns, no shared query
  that would benefit from a common table, and it would need a `type` discriminator plus nullable
  columns for whichever fields don't apply per type.
- **A new `student:360:read` permission separate from `mentor:workflow`**: rejected — Sprint 5
  established that one permission code can economically cover an entire domain workflow
  (`assignment:review` covers scoring + comments + publish); splitting Student 360 read access into
  its own code would be over-granular for what is, today, a single mentor-facing feature area.
- **Giving `REVIEWER` `mentor:workflow` too** (keeping the two roles' permissions identical, as they
  are today): rejected — a Reviewer's job (score rubrics on assignments they're assigned to) has no
  relationship to owning a caseload of students; keeping the codes distinct is more correct RBAC
  going forward even though it's the first time the two roles' permission sets diverge.
