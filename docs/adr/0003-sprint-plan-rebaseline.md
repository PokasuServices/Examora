# ADR-0003: Rebaseline MVP Sprint Plan from 6 to 13 Sprints

Status: Accepted
Date: 2026-07-18
Deciders: Product Owner

## Context

`20_Product_Backlog_User_Stories_and_Sprint_Planning_Specification` (AGILE-20) proposes a 6-sprint
MVP plan (e.g., Sprint 4 = "Creative assignments, Rubrics, Reviews" in a single 2-week sprint).
Cross-referencing against `10_Creative_Assignment_and_Review_Workflow_Specification` (CREATIVE-10),
`03_User_Roles_Permissions_and_Mentor_Flow` (DESIGN-03) and `11`/`31` (notifications) shows the
per-sprint scope in AGILE-20 understates the actual work by roughly 2x — the creative-assignment
lifecycle alone (upload validation, malware scan, versioning, rubric evaluation, annotations,
revision cycles, community gallery, XP/anti-fraud) does not fit in one sprint alongside mentoring
and notifications.

## Decision

Replace AGILE-20's 6-sprint plan with a **13-sprint plan** (documented in
`docs/roadmap/SPRINT_BACKLOG.md`), preserving the same epic order and full requirement scope from
every source document — no functional requirement is cut to fit the timeline. Sprint 0
(infrastructure only) precedes the 13 implementation sprints.

## Consequences

- MVP delivery timeline extends from ~12 weeks to ~26-28 weeks (13 sprints × 2 weeks), plus Sprint 0.
- No functional requirement from SRS-02, CREATIVE-10, DESIGN-03, or COMM-MERGED is deferred solely
  for schedule reasons; deferrals (if any) are tracked explicitly per sprint, not implied by
  compression.
- `docs/roadmap/SPRINT_BACKLOG.md` becomes the operative plan; AGILE-20 remains in `/documents` as
  the original strategic input (epics and release sequencing from AGILE-20 are still followed).

## Alternatives Considered

- **Keep 6 sprints, cut scope**: rejected by Product Owner — would require deferring parts of
  creative review, community, or mentoring to post-MVP releases, which changes the product, not
  just the schedule.
- **Time-box and let scope float per sprint**: rejected — conflicts with MDG-00's Definition of
  Done, which requires completed features (tests, Swagger, audit logging) rather than partial
  slices.
