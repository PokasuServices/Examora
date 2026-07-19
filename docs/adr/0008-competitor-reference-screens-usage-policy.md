# ADR-0008: Competitor Reference Screens — Functional Reference Only

Status: Accepted
Date: 2026-07-18
Deciders: Product Owner

## Context

`/screens` contains 45 screenshots captured from a competitor's exam-preparation platform. PRD-01
§1 and §9 already state the product "does not reproduce third-party branding or content" and lists
"importing or reproducing any third-party questions, videos, logos, copy or visual assets" as an
explicit non-goal. The Product Owner reconfirmed this directly: the screenshots exist solely to
understand competitor user flows, layout patterns and functional behavior.

## Decision

`/screens` is a **read-only functional reference**, consulted only to understand interaction
patterns (e.g., a syllabus-heatmap layout, a course-card grid, a coverage radar chart) during
UI/UX and frontend implementation (DS-18, UX-07). The following must never be copied, derived from,
or visually approximated from these screenshots:

- Branding, logos, icons
- Color palette, typography
- Copy/text content
- Images, illustrations
- Overall visual identity / look-and-feel

All UI implementation must originate from DS-18 (Design System) design tokens and original visual
design, inspired only by _functional_ behavior observed in the reference screens.

## Consequences

- Design tokens (color, type scale, spacing) in `packages/ui` are defined fresh against DS-18 §2,
  never sampled from screenshot pixels.
- Any frontend PR that visually resembles a specific reference screen beyond shared functional
  layout (e.g., "a grid of subject cards with a completion badge") should be flagged in code review.
- No OCR, asset extraction, or pixel-sampling tooling should ever be run against `/screens`.

## Alternatives Considered

- **Treat screens as unusable, delete them**: rejected — they remain valuable for understanding
  proven UX flows in this specific exam-prep domain; the risk is in copying output, not in looking
  at input.
