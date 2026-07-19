"use client";

import Link from "next/link";
import { useAuth } from "@examora/auth-client";
import { Button } from "@examora/ui";

export function AuthNav() {
  const { status, user } = useAuth();

  if (status === "loading") {
    return <span className="text-sm text-neutral-500">Loading…</span>;
  }

  if (status === "authenticated" && user) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-neutral-600">
          Signed in as {user.firstName ?? user.email}
        </span>
        <Link href="/profile">
          <Button variant="secondary">My profile</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link href="/login">
        <Button variant="secondary">Log in</Button>
      </Link>
      <Link href="/register">
        <Button variant="primary">Register</Button>
      </Link>
    </div>
  );
}
