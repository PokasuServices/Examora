"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiError } from "@examora/auth-client";
import type { Course, CourseProgress, Curriculum } from "@examora/types";
import { Button } from "@examora/ui";
import { ProgressBar } from "@/components/progress-bar";
import { RequireAuth } from "@/components/require-auth";
import { formatMoney, useCommerceApi } from "@/lib/commerce-api";
import { useLearningApi } from "@/lib/learning-api";
import { openRazorpayCheckout } from "@/lib/razorpay";

type AccessState = "checking" | "granted" | "locked";
type PurchaseState = "idle" | "starting" | "confirming" | "failed";

function PurchasePanel({
  course,
  purchaseState,
  purchaseError,
  onBuy,
}: {
  course: Course;
  purchaseState: PurchaseState;
  purchaseError: string | null;
  onBuy: () => void;
}) {
  const busy = purchaseState === "starting" || purchaseState === "confirming";
  return (
    <div className="mt-6 rounded-lg border border-primary-200 bg-primary-50 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-600">This course requires purchase</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">
            {formatMoney(course.priceAmount ?? 0, course.priceCurrency)}
          </p>
        </div>
        <Button disabled={busy} onClick={onBuy}>
          {purchaseState === "starting"
            ? "Starting checkout…"
            : purchaseState === "confirming"
              ? "Confirming payment…"
              : "Buy now"}
        </Button>
      </div>
      {purchaseError ? <p className="mt-3 text-sm text-error-600">{purchaseError}</p> : null}
      <p className="mt-3 text-xs text-neutral-500">
        Already purchased?{" "}
        <Link href="/orders" className="text-primary-600 hover:underline">
          Check your order history
        </Link>
        .
      </p>
    </div>
  );
}

function CourseContent() {
  const { id } = useParams<{ id: string }>();
  const learningApi = useLearningApi();
  const commerceApi = useCommerceApi();
  const [course, setCourse] = React.useState<Course | null>(null);
  const [curriculum, setCurriculum] = React.useState<Curriculum | null>(null);
  const [progress, setProgress] = React.useState<CourseProgress | null>(null);
  const [access, setAccess] = React.useState<AccessState>("checking");
  const [notFound, setNotFound] = React.useState(false);
  const [purchaseState, setPurchaseState] = React.useState<PurchaseState>("idle");
  const [purchaseError, setPurchaseError] = React.useState<string | null>(null);

  const loadCurriculum = React.useCallback(
    async (freeCourse: boolean) => {
      try {
        const [c, p] = await Promise.all([
          learningApi.getCurriculum(id),
          learningApi.getCourseProgress(id),
        ]);
        setCurriculum(c);
        setProgress(p);
        setAccess("granted");
        if (freeCourse) {
          // Best-effort: records the FREE enrollment so it appears in purchase
          // history. The gate itself never required this (free courses always
          // pass), so a failure here must never block viewing the course.
          commerceApi.enrollFree(id).catch(() => undefined);
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) {
          setAccess("locked");
        } else {
          setNotFound(true);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  );

  React.useEffect(() => {
    learningApi
      .getCourse(id)
      .then(setCourse)
      .catch(() => setNotFound(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  React.useEffect(() => {
    if (course) void loadCurriculum(course.priceAmount === null);
  }, [course, loadCurriculum]);

  async function pollOrderUntilSettled(orderId: string): Promise<void> {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const order = await commerceApi.getMyOrder(orderId);
      if (order.status === "PAID") {
        setPurchaseState("idle");
        setPurchaseError(null);
        await loadCurriculum(false);
        return;
      }
      if (order.status === "FAILED" || order.status === "CANCELLED") {
        setPurchaseState("failed");
        setPurchaseError("Payment was not completed. Please try again.");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    setPurchaseState("failed");
    setPurchaseError("Still confirming your payment — check My purchases shortly.");
  }

  async function handleBuy(): Promise<void> {
    setPurchaseState("starting");
    setPurchaseError(null);
    try {
      const session = await commerceApi.checkout(id);
      await openRazorpayCheckout(session, {
        onPaymentSubmitted: () => {
          setPurchaseState("confirming");
          void pollOrderUntilSettled(session.order.id);
        },
        onDismiss: () => setPurchaseState("idle"),
      });
    } catch (err) {
      setPurchaseState("failed");
      setPurchaseError(
        err instanceof ApiError && err.status === 503
          ? "Payments are not configured in this environment yet."
          : err instanceof ApiError
            ? err.message
            : "Could not start checkout. Please try again.",
      );
    }
  }

  if (notFound) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-heading">Course not available</h1>
        <Link
          href="/courses"
          className="mt-4 inline-block text-sm text-primary-600 hover:underline"
        >
          Back to courses
        </Link>
      </main>
    );
  }

  if (!course) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <nav className="mb-6 text-sm text-neutral-500">
        <Link href="/courses" className="hover:underline">
          Courses
        </Link>{" "}
        · <span className="text-neutral-800">{course.title}</span>
      </nav>

      <h1 className="text-heading">{course.title}</h1>
      {course.description ? <p className="mt-2 text-neutral-600">{course.description}</p> : null}

      {access === "locked" ? (
        <PurchasePanel
          course={course}
          purchaseState={purchaseState}
          purchaseError={purchaseError}
          onBuy={() => void handleBuy()}
        />
      ) : null}

      {access === "checking" ? (
        <p className="mt-6 text-sm text-neutral-500">Checking access…</p>
      ) : null}

      {access === "granted" && curriculum && progress ? (
        <>
          {course.priceAmount !== null ? (
            <span className="mt-4 inline-block rounded-full bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700">
              You have access to this course
            </span>
          ) : null}

          <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-600">
                {progress.completedLessons} of {progress.totalLessons} lessons ·{" "}
                {progress.percentComplete}%
              </span>
              {progress.nextLesson ? (
                <Link href={`/courses/${id}/lessons/${progress.nextLesson.id}`}>
                  <Button>{progress.completedLessons > 0 ? "Continue" : "Start learning"}</Button>
                </Link>
              ) : (
                <span className="text-sm font-medium text-success-600">Completed 🎉</span>
              )}
            </div>
            <div className="mt-3">
              <ProgressBar percent={progress.percentComplete} />
            </div>
          </div>

          <section className="mt-8 flex flex-col gap-6">
            {curriculum.subjects.map((subject) => (
              <div key={subject.id}>
                <h2 className="text-lg font-semibold">{subject.title}</h2>
                {subject.topics.map((topic) => (
                  <div key={topic.id} className="mt-3">
                    <h3 className="text-sm font-medium text-neutral-700">{topic.title}</h3>
                    {topic.modules.map((mod) => (
                      <div key={mod.id} className="mt-2">
                        <p className="text-xs uppercase tracking-wide text-neutral-400">
                          {mod.title}
                        </p>
                        <ul className="mt-1 flex flex-col divide-y divide-neutral-100 rounded-md border border-neutral-200 bg-white">
                          {mod.lessons.map((lesson) => (
                            <li key={lesson.id}>
                              <Link
                                href={`/courses/${id}/lessons/${lesson.id}`}
                                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-neutral-50"
                              >
                                <span>{lesson.title}</span>
                                <span
                                  className={
                                    lesson.completed ? "text-success-600" : "text-neutral-300"
                                  }
                                  aria-label={lesson.completed ? "Completed" : "Not completed"}
                                >
                                  ✓
                                </span>
                              </Link>
                            </li>
                          ))}
                          {mod.lessons.length === 0 ? (
                            <li className="px-4 py-3 text-sm text-neutral-400">No lessons yet.</li>
                          ) : null}
                        </ul>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </section>
        </>
      ) : null}
    </main>
  );
}

export default function CoursePage() {
  return (
    <RequireAuth>
      <CourseContent />
    </RequireAuth>
  );
}
