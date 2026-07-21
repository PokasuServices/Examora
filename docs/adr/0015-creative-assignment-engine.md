# ADR-0015: Creative Assignment Engine — Data Model, Upload/Scan Pipeline, Review Workflow

Status: Accepted
Date: 2026-07-21
Deciders: Engineering (Sprint 5)

## Context

Sprint 5 ("Creative Assignment Engine") delivers assignment authoring/templates, student
submission with draft/final states and file upload, reviewer assignment, rubric-based review with
marks and comments, a reviewer dashboard, and student submission history (CREATIVE-10 §2-4, §6;
FR-ASSIGN-01/02; FR-REVIEW-01). This is the first sprint touching object storage and any kind of
background job processing — neither existed in the codebase before this sprint, though Sprint 0
already provisioned MinIO/S3 environment variables and a Redis connection in anticipation (ADR-0005,
TD-005).

## Decisions

**Assignment Templates are a copy-from source, not a live relation.** `AssignmentTemplate` is a
standalone, admin-authored preset (brief, file rules, marks, rubric skeleton). Creating an
assignment "from a template" copies the template's fields onto a new `Assignment` at creation time;
there is no `templateId` FK on `Assignment` afterward. Editing a template never retroactively
changes assignments already created from it — this matches the no-versioning "editing mutates in
place, nothing is silently linked forever" philosophy already established for content (ADR-0012)
and avoids a template edit unexpectedly rewriting a live assignment's rubric mid-submission-cycle.

**Assignment reuses the shared `ContentStatus` lifecycle** (DRAFT/PUBLISHED/ARCHIVED) via the same
`assertValidStatusTransition` state machine as Course/Question/Quiz (ADR-0012/0014). Only PUBLISHED
assignments are visible to students. `assignment:publish` is a separate permission from
`assignment:manage`, mirroring the established author/publisher split.

**Rubric criteria belong to the assignment, not the template, once created.** `RubricCriterion`
rows are created from the template's skeleton (or from scratch) at assignment-authoring time and
then edited independently — same reasoning as the template-copy decision above.

**Each resubmission is a new `AssignmentSubmission` row, not an in-place edit** — directly mirroring
Sprint 4's `QuizAttempt` precedent ("each attempt is a new row," ADR-0014). A submission starts
`DRAFT` (student can add/remove files, edit notes), moves to `SUBMITTED` on the student's explicit
final-submit action (locks file/notes editing), and is reviewed from there. If a review's decision
is `REVISION_REQUESTED`, the student's next action creates a **new** `AssignmentSubmission` row with
`version = previous + 1`; the previous version and its review are retained, giving "Student
Assignment History" for free as "every submission row for this student+assignment, newest first" —
no separate history/audit table needed.

**Submission status is a 5-state machine**: `DRAFT → SUBMITTED → UNDER_REVIEW → {REVISION_REQUESTED,
APPROVED}`. `UNDER_REVIEW` is entered when a reviewer saves an in-progress (unpublished) review —
this gives the reviewer dashboard a genuine "in progress" bucket distinct from "not started yet,"
and lets a reviewer safely save partial rubric scores without exposing them to the student
(`AssignmentReview.status` is itself `DRAFT`/`PUBLISHED`; only a `PUBLISHED` review flips the
submission to its terminal state).

**File upload is presigned-URL-based, not server-mediated.** The API never receives raw file bytes.
A student calls `POST .../files/presign` (validates MIME type/size against the assignment's file
rules first) and receives a time-limited S3-compatible PUT URL plus the object's future storage
key; the browser uploads directly to MinIO/S3; the student then calls `POST .../files/confirm`,
which creates a `SubmissionFile` row with `scanStatus = PENDING` and enqueues a malware-scan job.
This matches "signed upload" from the original FR-ASSIGN-02 planning note, keeps large file bytes
off the NestJS process entirely, and is the same shape a production deployment would use.

**Malware scanning is quarantine-by-default via a real ClamAV integration behind a port, exactly
mirroring `MailerPort`/`ConsoleMailerService` (ADR-0009).** A `MalwareScannerPort` interface
(`scan(buffer): Promise<{clean: boolean; signature?: string}>`) is implemented by
`ClamAvScannerService` (talks to a `clamd` daemon added to `docker-compose.yml`, via the `clamscan`
package) for real local/staging/production use. `SubmissionFile.scanStatus` starts `PENDING`; a
BullMQ job (`@nestjs/bullmq`, backed by the existing Redis connection) downloads the object from
storage, scans it, and sets `CLEAN` or `INFECTED` — an infected file is deleted from storage
immediately and never becomes visible to a reviewer. A reviewer/student can only ever fetch a
presigned **download** URL for a file whose `scanStatus = CLEAN`; `PENDING`/`INFECTED`/`FAILED`
files 404 on download regardless of who's asking. Automated tests inject a
`FakeMalwareScannerService` (deterministic — the real industrial-standard EICAR test string is
treated as infected, everything else clean) so the suite doesn't depend on a running ClamAV daemon
or its signature-database download time; the real `ClamAvScannerService` is still exercised manually
against a live `clamd` container as part of this sprint's validation, same as ADR-0009's stub/real
split.

**`StoragePort` is also faked for automated tests, for a different reason than the scanner.**
Presigned-URL generation (`getPresignedUploadUrl`) is a pure local computation (the AWS SDK signs a
URL string with local credentials — no network call), so it's safe to unit-test directly against the
real `S3StorageService`. But `.github/workflows/ci.yml` has no MinIO/S3-compatible service (only
Postgres and Redis), so any test exercising `getObjectBuffer`/`deleteObject` (the malware-scan job's
path) would fail in CI. `FakeStorageService` (in-memory `Map<key, Buffer>`) backs the full automated
suite so it never depends on CI wiring a storage backend; `S3StorageService` against the local
docker-compose MinIO is validated manually as part of this sprint (same spirit as TD-006's existing
manual-browser-verification note for frontend flows Playwright doesn't cover yet).

**Comments are a separate flat model from rubric scoring**, not folded into `RubricCriterion`
scores. `AssignmentComment` is a simple, timestamped, submission-scoped note (author + body) visible
to the student, the assigned reviewer, and admins — satisfies "Comments" as its own capability
(distinct from the structured per-criterion rubric feedback that lives on `RubricScore`).

**Reviewer assignment is a direct field on `AssignmentSubmission`** (`reviewerId`), not a join
table — a submission has exactly one active reviewer at a time; reassignment overwrites the field
and is captured by `AuditLog` (the existing "who changed what, when" source of truth, ADR-0012),
not a bespoke history table. Assigning/reassigning a reviewer requires `assignment:manage`
(ADMINISTRATOR) this sprint — no self-claim/self-assign workflow for MENTOR/REVIEWER yet.

**Positional image annotations (CREATIVE-10 §7) are explicitly deferred** — not in this sprint's
approved scope (see `docs/roadmap/SPRINT_BACKLOG.md` Sprint 5). Review feedback is rubric scores +
freeform comments only, no annotation canvas.

## Consequences

- Three new pieces of infrastructure land in this sprint that no earlier sprint needed: an S3-
  compatible storage client (`StoragePort`/`S3StorageService`), a malware-scan queue
  (`@nestjs/bullmq` + a new `clamd` docker-compose service), and the first genuinely async,
  eventually-consistent piece of state in the platform (`scanStatus` starts `PENDING` and is
  updated out-of-band) — every file-serving path must treat `PENDING` as "not yet available," not
  "available."
- `AssignmentSubmission` versioning means a `RubricScore`/`AssignmentReview` always points at one
  specific submission version — a later resubmission never retroactively invalidates or edits a
  prior review, matching the immutable-once-published pattern used throughout (quiz results,
  audit logs).
- The docker-compose `clamd` service adds real startup latency (signature database load) to a full
  local environment bring-up; the automated test suite does not depend on it (see the
  `FakeMalwareScannerService` decision above), so this cost is opt-in, not paid by CI.

## Alternatives Considered

- **Server-mediated upload (multipart through the NestJS API)**: rejected — adds a multer
  dependency and routes large file bytes through the API process for no benefit over presigned
  direct-to-storage upload, which is both simpler to scale and the shape a production deployment
  would actually use.
- **A stub/fake malware scanner only, real ClamAV deferred**: rejected — TD-005 already anticipated
  a real ClamAV integration landing with Creative Assignments regardless of sprint number; building
  the real adapter now (with a fast fake swapped in purely for automated tests, per the MailerPort
  precedent) is no more work than building a stub and getting real virus-scanning coverage sooner.
- **Reviewer assignment as its own join table** (supporting multiple reviewers per submission):
  rejected as unnecessary complexity for this sprint's scope — one active reviewer per submission
  is sufficient; revisit if peer-review (multiple simultaneous reviewers) becomes a requirement.
