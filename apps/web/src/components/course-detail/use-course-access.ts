"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import type { Course, CourseProgress, Curriculum } from "@examora/types";
import { useCommerceApi } from "@/lib/commerce-api";
import { useLearningApi } from "@/lib/learning-api";
import { openRazorpayCheckout } from "@/lib/razorpay";
import type { AccessState, PurchaseState } from "./types";

/**
 * The course access + purchase state machine — relocated verbatim from the
 * previous /courses/[id] page (same functions, same behavior, same Razorpay
 * flow) so the new presentation layer never re-implements checkout logic.
 */
export function useCourseAccess(courseId: string) {
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
          learningApi.getCurriculum(courseId),
          learningApi.getCourseProgress(courseId),
        ]);
        setCurriculum(c);
        setProgress(p);
        setAccess("granted");
        if (freeCourse) {
          // Best-effort: records the FREE enrollment so it appears in purchase
          // history. The gate itself never required this (free courses always
          // pass), so a failure here must never block viewing the course.
          commerceApi.enrollFree(courseId).catch(() => undefined);
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
    [courseId],
  );

  React.useEffect(() => {
    learningApi
      .getCourse(courseId)
      .then(setCourse)
      .catch(() => setNotFound(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

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
      const session = await commerceApi.checkout(courseId);
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

  return {
    course,
    curriculum,
    progress,
    access,
    notFound,
    purchaseState,
    purchaseError,
    handleBuy: () => void handleBuy(),
  };
}
