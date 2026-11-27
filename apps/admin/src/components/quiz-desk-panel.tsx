"use client";

import * as React from "react";
import { Brush, FileSpreadsheet, Users } from "lucide-react";
import { Button, cn } from "@examora/ui";
import { ExcelBar, Pill, ToneCard, ToneIcon, useToast } from "@/components/desk-ui";
import { useDeskApi, type QuizBatches } from "@/lib/desk-api";

/**
 * Mentor tools on a quiz: publish it to batches, move questions in and out of
 * Excel (duplicates are flagged before import), and enter sketch marks given
 * offline.
 */
export function QuizDeskPanel({ quizId, onChanged }: { quizId: string; onChanged: () => void }) {
  const api = useDeskApi();
  const { toast, toastError, node } = useToast();
  const [batches, setBatches] = React.useState<QuizBatches | null>(null);
  const [picked, setPicked] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(() => {
    api
      .quizBatches(quizId)
      .then((b) => {
        setBatches(b);
        setPicked(b.batches.filter((x) => x.selected).map((x) => x.id));
      })
      .catch(() => setBatches(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);
  React.useEffect(() => load(), [load]);

  const changed = batches
    ? batches.batches.some((b) => b.selected !== picked.includes(b.id))
    : false;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {node}
      <ToneCard tone="indigo" className="p-4">
        <div className="flex items-center gap-2">
          <ToneIcon tone="indigo" icon={Users} size="sm" />
          <h2 className="font-heading text-sm font-semibold">Who takes it</h2>
        </div>
        {!batches ? (
          <p className="mt-2 text-xs text-neutral-500">Loading…</p>
        ) : (
          <>
            <p className="mt-2 text-xs text-neutral-500">
              {picked.length === 0 && batches.others === 0
                ? "Everyone on the course (no batch chosen)."
                : "Only the ticked batches see it."}
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {batches.batches.map((b) => (
                <li key={b.id}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={picked.includes(b.id)}
                      onChange={() =>
                        setPicked((p) =>
                          p.includes(b.id) ? p.filter((x) => x !== b.id) : [...p, b.id],
                        )
                      }
                    />
                    <span className="truncate">{b.name}</span>
                    <span className="ml-auto text-xs text-neutral-500">{b.students}</span>
                  </label>
                </li>
              ))}
            </ul>
            {batches.others ? (
              <p className="mt-1 text-xs text-neutral-500">
                + {batches.others} other mentors&rsquo; batches
              </p>
            ) : null}
            <Button
              size="sm"
              className="mt-3"
              disabled={!changed || saving}
              onClick={async () => {
                setSaving(true);
                try {
                  const b = await api.setQuizBatches(quizId, picked);
                  setBatches(b);
                  toast(
                    picked.length ? "Published to the chosen batches" : "Open to the whole course",
                  );
                } catch (e) {
                  toastError(e);
                } finally {
                  setSaving(false);
                }
              }}
            >
              Save
            </Button>
          </>
        )}
      </ToneCard>

      <ToneCard tone="emerald" index={1} className="p-4">
        <div className="flex items-center gap-2">
          <ToneIcon tone="emerald" icon={FileSpreadsheet} size="sm" />
          <h2 className="font-heading text-sm font-semibold">Questions in Excel</h2>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Answers and explanations (text, image or video links) in one sheet. Similar existing
          questions are flagged before anything is saved.
        </p>
        <div className="mt-3">
          <ExcelBar
            downloadLabel="Download"
            onDownload={() =>
              api.download(`/mentor-desk/quizzes/${quizId}/questions/export`, "questions.xlsx")
            }
            onTemplate={() =>
              api.download("/mentor-desk/questions/template", "questions-template.xlsx")
            }
            onUpload={(b64, name, dry) => api.importQuestions({ quizId }, b64, name, dry)}
            onImported={() => onChanged()}
          />
        </div>
      </ToneCard>

      <ToneCard tone="violet" index={2} className="p-4">
        <div className="flex items-center gap-2">
          <ToneIcon tone="violet" icon={Brush} size="sm" />
          <h2 className="font-heading text-sm font-semibold">Sketch marks in Excel</h2>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Marked sketches on paper? Download the sheet of uploads, fill Marks and Comment, and
          upload it back. Scores update.
        </p>
        <div className="mt-3">
          <ExcelBar
            downloadLabel="Download"
            onDownload={() =>
              api.download(`/mentor-desk/quizzes/${quizId}/marks/export`, "marks.xlsx")
            }
            onTemplate={() =>
              api.download(`/mentor-desk/quizzes/${quizId}/marks/template`, "marks-template.xlsx")
            }
            onUpload={(b64, name, dry) => api.importMarks(quizId, b64, name, dry)}
            onImported={() => onChanged()}
          />
        </div>
      </ToneCard>
      <p className={cn("text-xs text-neutral-500 lg:col-span-3")}>
        <Pill tone="slate">Tip</Pill> Mock tests and class quizzes publish straight away. Past
        papers (with an exam year) go to the admin for review.
      </p>
    </div>
  );
}
