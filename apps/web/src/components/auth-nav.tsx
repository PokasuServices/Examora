"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@examora/auth-client";
import { Button } from "@examora/ui";
import { useNotificationsApi } from "@/lib/notifications-api";

function NotificationsLink() {
  const api = useNotificationsApi();
  const [unread, setUnread] = React.useState(0);

  React.useEffect(() => {
    api
      .unreadCount()
      .then((res) => setUnread(res.unread))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Link href="/notifications" className="relative">
      <Button variant="secondary">
        Notifications
        {unread > 0 ? (
          <span className="ml-2 rounded-full bg-primary-600 px-1.5 py-0.5 text-xs font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </Button>
    </Link>
  );
}

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
        <Link href="/courses">
          <Button variant="secondary">Explore courses</Button>
        </Link>
        <Link href="/quizzes">
          <Button variant="secondary">Quizzes</Button>
        </Link>
        <Link href="/assignments">
          <Button variant="secondary">Assignments</Button>
        </Link>
        <Link href="/community">
          <Button variant="secondary">Community</Button>
        </Link>
        <Link href="/dashboard">
          <Button variant="secondary">My learning</Button>
        </Link>
        <Link href="/orders">
          <Button variant="secondary">My purchases</Button>
        </Link>
        <NotificationsLink />
        <Link href="/profile">
          <Button variant="ghost">Profile</Button>
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
