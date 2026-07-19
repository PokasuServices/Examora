"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ApiError, useAuth } from "@examora/auth-client";
import { CURRENT_TERMS_VERSION } from "@examora/shared";
import { Button, FieldError, Input, Label } from "@examora/ui";
import type { UserProfile } from "@examora/types";

interface Session {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export default function ProfilePage() {
  const router = useRouter();
  const { status, user, logout } = useAuth();

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status !== "authenticated" || !user) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-12">
      <header className="flex items-center justify-between">
        <h1 className="text-heading">Your profile</h1>
        <Button variant="ghost" onClick={() => void logout().then(() => router.push("/login"))}>
          Log out
        </Button>
      </header>

      <ProfileForm />
      <ConsentSection />
      <SessionsSection />
    </main>
  );
}

function ProfileForm() {
  const { request, refetchUser } = useAuth();
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    request<UserProfile>("/users/me", { method: "GET" })
      .then(setProfile)
      .catch(() => undefined);
  }, [request]);

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!profile) return;
    setError(null);
    setSuccess(false);
    setSubmitting(true);
    try {
      const updated = await request<UserProfile>("/users/me", {
        method: "PUT",
        body: {
          firstName: profile.firstName ?? undefined,
          lastName: profile.lastName ?? undefined,
          phone: profile.phone ?? undefined,
          dateOfBirth: profile.dateOfBirth ?? undefined,
          guardianName: profile.guardianName ?? undefined,
          guardianEmail: profile.guardianEmail ?? undefined,
        },
      });
      setProfile(updated);
      setSuccess(true);
      await refetchUser();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your profile.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!profile) {
    return <p className="text-sm text-neutral-500">Loading profile…</p>;
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-6">
      <h2 className="text-lg font-semibold">Basic information</h2>
      <p className="mt-1 text-sm text-neutral-500">
        {profile.email} · {profile.emailVerified ? "Verified" : "Not verified yet"}
      </p>

      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              value={profile.firstName ?? ""}
              onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lastName">Last name</Label>
            <Input
              id="lastName"
              value={profile.lastName ?? ""}
              onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={profile.phone ?? ""}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dateOfBirth">Date of birth</Label>
          <Input
            id="dateOfBirth"
            type="date"
            value={profile.dateOfBirth ?? ""}
            onChange={(e) => setProfile({ ...profile, dateOfBirth: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="guardianName">Guardian name</Label>
            <Input
              id="guardianName"
              value={profile.guardianName ?? ""}
              onChange={(e) => setProfile({ ...profile, guardianName: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="guardianEmail">Guardian email</Label>
            <Input
              id="guardianEmail"
              type="email"
              value={profile.guardianEmail ?? ""}
              onChange={(e) => setProfile({ ...profile, guardianEmail: e.target.value })}
            />
          </div>
        </div>
        <FieldError>{error}</FieldError>
        {success ? <p className="text-sm text-success-600">Profile saved.</p> : null}
        <div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function ConsentSection() {
  const { request } = useAuth();
  const [marketingGranted, setMarketingGranted] = React.useState<boolean | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function toggleMarketing(): Promise<void> {
    const next = !(marketingGranted ?? false);
    setSaving(true);
    try {
      await request("/users/me/consent", {
        method: "POST",
        body: { type: "MARKETING", version: CURRENT_TERMS_VERSION, channel: "web", granted: next },
      });
      setMarketingGranted(next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-6">
      <h2 className="text-lg font-semibold">Communication preferences</h2>
      <label className="mt-4 flex items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={marketingGranted ?? false}
          disabled={saving}
          onChange={() => void toggleMarketing()}
        />
        Send me product updates and marketing emails
      </label>
    </section>
  );
}

function SessionsSection() {
  const { request } = useAuth();
  const [sessions, setSessions] = React.useState<Session[] | null>(null);

  const load = React.useCallback(() => {
    request<Session[]>("/auth/sessions", { method: "GET" })
      .then(setSessions)
      .catch(() => undefined);
  }, [request]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function revoke(id: string): Promise<void> {
    await request(`/auth/sessions/${id}`, { method: "DELETE" });
    load();
  }

  async function revokeAll(): Promise<void> {
    await request("/auth/sessions", { method: "DELETE" });
    load();
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Active sessions</h2>
        {sessions && sessions.length > 1 ? (
          <Button variant="ghost" onClick={() => void revokeAll()}>
            Log out other sessions
          </Button>
        ) : null}
      </div>
      <ul className="mt-4 flex flex-col gap-3">
        {(sessions ?? []).map((session) => (
          <li
            key={session.id}
            className="flex items-center justify-between rounded-md border border-neutral-100 p-3 text-sm"
          >
            <div>
              <p className="font-medium">
                {session.userAgent ?? "Unknown device"} {session.isCurrent ? "(this device)" : ""}
              </p>
              <p className="text-neutral-500">
                {session.ipAddress} · started {new Date(session.createdAt).toLocaleString()}
              </p>
            </div>
            {!session.isCurrent ? (
              <Button variant="ghost" onClick={() => void revoke(session.id)}>
                Revoke
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
