"use client";

import * as React from "react";
import { Check, Copy, Share2 } from "lucide-react";
import type { TestShareInfo } from "@examora/types";
import { Button } from "@examora/ui";
import { Card } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";
import { useStudentApi } from "@/lib/student-api";

/**
 * "Share this test": the student's own link. They earn XP when classmates who
 * are signed in open it (once per person, capped).
 */
export function ShareTestCard({ quizId, title }: { quizId: string; title: string }) {
  const api = useStudentApi();
  const apiRef = React.useRef(api);
  apiRef.current = api;
  const [info, setInfo] = React.useState<TestShareInfo | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    apiRef.current
      .testShare(quizId)
      .then(setInfo)
      .catch(() => setInfo(null));
  }, [quizId]);

  const linkFor = (code: string) =>
    `${window.location.origin}/practice/tests/${quizId}?ref=${encodeURIComponent(code)}`;

  async function share() {
    setBusy(true);
    setFailed(false);
    try {
      const next = info?.code ? info : await api.createTestShare(quizId);
      setInfo(next);
      const url = linkFor(next.code!);
      if (typeof navigator.share === "function") {
        await navigator.share({ title, text: `Try "${title}" on Examora`, url }).catch(() => {
          // Closing the share sheet is not an error.
        });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!info?.code) return;
    try {
      await navigator.clipboard.writeText(linkFor(info.code));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setFailed(true);
    }
  }

  const perPerson = info?.xpPerVisitor ?? 5;
  const cap = info?.maxRewarded ?? 10;

  return (
    <Card density="compact" className="flex flex-wrap items-center gap-4">
      <IconBadge icon={Share2} tone="success" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-800 dark:text-white/90">
          Share this test with classmates
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          +{perPerson} XP for each classmate who opens your link (up to {cap}).
          {info && info.visitors > 0
            ? ` ${info.visitors} opened it so far · +${info.xpEarned} XP earned.`
            : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span aria-live="polite" className="text-xs">
          {copied ? (
            <span className="inline-flex items-center gap-1 text-success-600">
              <Check size={14} aria-hidden="true" /> Link copied
            </span>
          ) : failed ? (
            <span className="text-danger-600">Couldn&rsquo;t share. Try again.</span>
          ) : null}
        </span>
        {info?.code ? (
          <Button size="sm" variant="ghost" onClick={() => void copy()} aria-label="Copy link">
            <Copy size={14} aria-hidden="true" />
          </Button>
        ) : null}
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void share()}>
          {busy ? "Preparing…" : "Share test"}
        </Button>
      </div>
    </Card>
  );
}
