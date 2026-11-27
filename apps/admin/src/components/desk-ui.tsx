"use client";

import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { ApiError } from "@examora/auth-client";
import type { ImportPreview, ImportResult } from "@examora/types";
import { Button, cn } from "@examora/ui";
import { ToneCard, ToneIcon, toneClasses, type Tone } from "@/components/ui/tone-card";
import { fileToBase64, saveBase64Xlsx } from "@/lib/desk-api";

export { ToneCard, ToneIcon, toneClasses, type Tone };

/** A headline number in a soft colour card (optionally a link). */
export function StatTile({
  tone,
  icon,
  label,
  value,
  hint,
  href,
  index = 0,
}: {
  tone: Tone;
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  href?: string;
  index?: number;
}) {
  const body = (
    <ToneCard tone={tone} index={index} interactive={!!href} className="h-full p-4">
      <div className="flex items-start gap-3">
        <ToneIcon tone={tone} icon={icon} size="sm" />
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {label}
          </p>
          <p className="mt-0.5 font-heading text-2xl font-semibold text-neutral-900 dark:text-white">
            {value}
          </p>
          {hint ? (
            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>
          ) : null}
        </div>
      </div>
    </ToneCard>
  );
  return href ? (
    <Link
      href={href}
      className="block h-full rounded-card focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      {body}
    </Link>
  ) : (
    body
  );
}

/** A thin progress bar that grows in. */
export function Meter({
  value,
  tone = "indigo",
  label,
}: {
  value: number | null;
  tone?: Tone;
  label?: string;
}) {
  const v = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value ?? undefined}
      aria-label={label}
    >
      <div
        className={cn(
          "h-full origin-left rounded-full motion-safe:animate-grow-x",
          toneClasses(tone).line,
        )}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

/** Tone for an attendance / score percentage. */
export function percentTone(p: number | null): Tone {
  if (p === null) return "slate";
  if (p >= 85) return "emerald";
  if (p >= 75) return "cyan";
  if (p >= 60) return "amber";
  return "rose";
}

export function Pill({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  const t = toneClasses(tone);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        t.soft,
        t.text,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-heading text-base font-semibold text-neutral-800 dark:text-white/90">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = React.useState<{ text: string; tone: "ok" | "info" | "error" } | null>(
    null,
  );
  React.useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 4500);
    return () => clearTimeout(t);
  }, [msg]);
  const node = msg ? (
    <div
      role="status"
      className={cn(
        "fixed bottom-6 right-6 z-[99999] max-w-sm rounded-lg px-4 py-3 text-sm shadow-soft-hover motion-safe:animate-fade-up",
        msg.tone === "ok" && "bg-emerald-600 text-white",
        msg.tone === "info" && "bg-neutral-900 text-white",
        msg.tone === "error" && "bg-rose-600 text-white",
      )}
    >
      {msg.text}
    </div>
  ) : null;
  return {
    toast: (text: string, tone: "ok" | "info" | "error" = "ok") => setMsg({ text, tone }),
    toastError: (err: unknown, fallback = "Something went wrong") =>
      setMsg({
        text: err instanceof ApiError || err instanceof Error ? err.message : fallback,
        tone: "error",
      }),
    node,
  };
}

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const id = React.useId();
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[99998] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-neutral-900/50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={cn(
          "relative max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-6 shadow-soft-hover motion-safe:animate-fade-up dark:border-neutral-800 dark:bg-neutral-900",
          wide ? "max-w-3xl" : "max-w-lg",
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2
            id={id}
            className="font-heading text-lg font-semibold text-neutral-900 dark:text-white"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/5"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function isResult(x: ImportPreview | ImportResult): x is ImportResult {
  return "imported" in x;
}

/**
 * The shared Excel toolkit bar: download the report, the same sheet as an
 * empty template, and upload it back (checked first, then imported).
 */
export function ExcelBar({
  onDownload,
  onTemplate,
  onUpload,
  downloadLabel = "Download report",
  templateLabel = "Empty template",
  uploadLabel = "Upload",
  onImported,
  disabled,
}: {
  onDownload?: () => Promise<void>;
  onTemplate?: () => Promise<void>;
  onUpload?: (
    contentBase64: string,
    fileName: string,
    dryRun: boolean,
  ) => Promise<ImportPreview | ImportResult>;
  downloadLabel?: string;
  templateLabel?: string;
  uploadLabel?: string;
  onImported?: (r: ImportResult) => void;
  disabled?: boolean;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [file, setFile] = React.useState<{ name: string; base64: string } | null>(null);
  const [preview, setPreview] = React.useState<ImportPreview | null>(null);
  const [result, setResult] = React.useState<ImportResult | null>(null);

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function pick(f: File) {
    if (!onUpload) return;
    await run("check", async () => {
      const base64 = await fileToBase64(f);
      setFile({ name: f.name, base64 });
      const r = await onUpload(base64, f.name, true);
      setResult(null);
      setPreview(isResult(r) ? null : r);
    });
  }

  async function commit() {
    if (!onUpload || !file) return;
    await run("import", async () => {
      const r = await onUpload(file.base64, file.name, false);
      if (isResult(r)) {
        setResult(r);
        setPreview(null);
        onImported?.(r);
      }
    });
  }

  const close = () => {
    setPreview(null);
    setResult(null);
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {onDownload ? (
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled || !!busy}
          onClick={() => void run("dl", onDownload)}
        >
          <Download size={14} aria-hidden="true" /> {busy === "dl" ? "Preparing…" : downloadLabel}
        </Button>
      ) : null}
      {onTemplate ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled || !!busy}
          onClick={() => void run("tpl", onTemplate)}
        >
          <FileSpreadsheet size={14} aria-hidden="true" />{" "}
          {busy === "tpl" ? "Preparing…" : templateLabel}
        </Button>
      ) : null}
      {onUpload ? (
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            aria-label={uploadLabel}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pick(f);
            }}
          />
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled || !!busy}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={14} aria-hidden="true" /> {busy === "check" ? "Checking…" : uploadLabel}
          </Button>
        </>
      ) : null}
      {error ? (
        <span role="alert" className="text-xs text-rose-600">
          {error}
        </span>
      ) : null}

      {preview && file ? (
        <Modal title="Check before importing" onClose={close} wide>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            <strong>{file.name}</strong>: {preview.ok} {preview.ok === 1 ? "row is" : "rows are"}{" "}
            ready
            {preview.issues.length ? `, ${preview.issues.length} need fixing` : ""}.
          </p>
          {preview.issues.length ? (
            <ul className="mt-3 max-h-40 overflow-y-auto rounded-md bg-rose-50 p-3 text-xs text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">
              {preview.issues.map((i, n) => (
                <li key={n} className="flex gap-2">
                  <AlertTriangle size={13} aria-hidden="true" className="mt-0.5 shrink-0" /> Row{" "}
                  {i.row}: {i.message}
                </li>
              ))}
            </ul>
          ) : null}
          {preview.warnings.length ? (
            <ul className="mt-3 max-h-40 overflow-y-auto rounded-md bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              {preview.warnings.map((i, n) => (
                <li key={n}>
                  Row {i.row}: {i.message}
                </li>
              ))}
            </ul>
          ) : null}
          {preview.sample.length ? (
            <div className="mt-3 overflow-x-auto rounded-md border border-neutral-200 dark:border-neutral-800">
              <table className="min-w-full text-xs">
                <thead className="bg-neutral-50 text-left dark:bg-white/[0.03]">
                  <tr>
                    {preview.columns.slice(0, 8).map((c) => (
                      <th key={c} className="whitespace-nowrap px-2 py-1.5 font-medium">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((r, i) => (
                    <tr key={i} className="border-t border-neutral-100 dark:border-neutral-800">
                      {preview.columns.slice(0, 8).map((c) => (
                        <td key={c} className="max-w-[12rem] truncate px-2 py-1">
                          {r[c]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button disabled={preview.ok === 0 || busy === "import"} onClick={() => void commit()}>
              {busy === "import"
                ? "Importing…"
                : `Import ${preview.ok} ${preview.ok === 1 ? "row" : "rows"}`}
            </Button>
          </div>
        </Modal>
      ) : null}

      {result ? (
        <Modal title="Import finished" onClose={close}>
          <div className="flex items-start gap-3">
            <CheckCircle2 size={22} aria-hidden="true" className="mt-0.5 text-emerald-600" />
            <div className="text-sm text-neutral-700 dark:text-neutral-200">
              <p>
                <strong>{result.imported}</strong> saved
                {result.requests ? (
                  <>
                    , <strong>{result.requests}</strong> sent to the admin for approval
                  </>
                ) : null}
                {result.skipped ? (
                  <>
                    , <strong>{result.skipped}</strong> skipped
                  </>
                ) : null}
                .
              </p>
              {result.errorFile ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-3"
                  onClick={() => saveBase64Xlsx(result.errorFile!, "rows-to-fix.xlsx")}
                >
                  <Download size={14} aria-hidden="true" /> Download the rows to fix
                </Button>
              ) : null}
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <Button onClick={close}>Done</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

/** Today in India as YYYY-MM-DD. */
export function todayIso(): string {
  return new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
}

export function addDaysIso(d: string, n: number): string {
  return new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
}

const DATE_FMT = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
export function dayLabel(d: string): string {
  return DATE_FMT.format(new Date(`${d}T00:00:00Z`));
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}
