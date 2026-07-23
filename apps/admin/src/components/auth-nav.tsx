"use client";

import Link from "next/link";
import { useAuth } from "@examora/auth-client";
import { Button } from "@examora/ui";

export function AuthNav() {
  const { status, user, logout } = useAuth();

  if (status === "loading") {
    return <span className="text-sm text-neutral-500">Loading…</span>;
  }

  if (status === "authenticated" && user) {
    const canManageContent = user.permissions.includes("content:manage");
    const canReadProgress = user.permissions.includes("progress:read");
    const canManageAssessment =
      user.permissions.includes("question:manage") || user.permissions.includes("quiz:manage");
    const canReadAttempts = user.permissions.includes("quiz:attempts:read");
    const canManageAssignments = user.permissions.includes("assignment:manage");
    const canReview = user.permissions.includes("assignment:review");
    const canManageMentors = user.permissions.includes("mentor:manage");
    const canMentorWorkflow = user.permissions.includes("mentor:workflow");
    const canManageCommunity = user.permissions.includes("community:manage");
    const canModerateCommunity = user.permissions.includes("community:moderate");
    const canManageCommerce = user.permissions.includes("commerce:manage");
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-neutral-600">{user.email}</span>
        {canManageContent ? (
          <Link href="/content/courses">
            <Button variant="secondary">Content</Button>
          </Link>
        ) : null}
        {canManageAssessment ? (
          <Link href="/assessment/quizzes">
            <Button variant="secondary">Quizzes</Button>
          </Link>
        ) : null}
        {canReadAttempts ? (
          <Link href="/assessment/attempts">
            <Button variant="secondary">Attempts</Button>
          </Link>
        ) : null}
        {canManageAssignments ? (
          <Link href="/assignments">
            <Button variant="secondary">Assignments</Button>
          </Link>
        ) : null}
        {canReview ? (
          <Link href="/assignments/reviewer">
            <Button variant="secondary">Reviews</Button>
          </Link>
        ) : null}
        {canManageMentors ? (
          <Link href="/mentors">
            <Button variant="secondary">Mentors</Button>
          </Link>
        ) : null}
        {canMentorWorkflow ? (
          <Link href="/mentor-dashboard">
            <Button variant="secondary">My mentees</Button>
          </Link>
        ) : null}
        {canManageCommunity ? (
          <Link href="/community/forums">
            <Button variant="secondary">Forums</Button>
          </Link>
        ) : null}
        {canModerateCommunity ? (
          <Link href="/community/moderation">
            <Button variant="secondary">Moderation</Button>
          </Link>
        ) : null}
        {canManageCommerce ? (
          <Link href="/commerce/orders">
            <Button variant="secondary">Commerce</Button>
          </Link>
        ) : null}
        {canReadProgress ? (
          <Link href="/progress">
            <Button variant="secondary">Progress</Button>
          </Link>
        ) : null}
        <Link href="/users">
          <Button variant="secondary">Users</Button>
        </Link>
        <Button variant="ghost" onClick={() => void logout()}>
          Log out
        </Button>
      </div>
    );
  }

  return (
    <Link href="/login">
      <Button variant="primary">Sign in</Button>
    </Link>
  );
}
