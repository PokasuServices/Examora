import { SetMetadata } from "@nestjs/common";
import type { ScopeKind } from "./staff-scope.service";

export const SCOPED_KEY = "staff:scoped";

export interface ScopedRule {
  kind: ScopeKind;
  from: "params" | "query" | "body";
  key: string;
}

/**
 * Hides a record from a mentor whose batches don't cover it: the global
 * StaffScopeGuard resolves each named value to its course/batch/student and
 * answers 404 when it's outside the mentor's scope. Absent values are skipped.
 *
 *   @Scoped("quiz", "params:id")         // /quizzes/:id
 *   @Scoped("subject", "body:subjectId") // create under a subject
 */
export const Scoped = (...pairs: [ScopeKind, `${ScopedRule["from"]}:${string}`][]) =>
  SetMetadata(
    SCOPED_KEY,
    pairs.map(([kind, path]) => {
      const [from, key] = path.split(":") as [ScopedRule["from"], string];
      return { kind, from, key } satisfies ScopedRule;
    }),
  );

/** Shorthand for a single rule. */
export const ScopedBy = (kind: ScopeKind, path: `${ScopedRule["from"]}:${string}`) =>
  Scoped([kind, path]);
