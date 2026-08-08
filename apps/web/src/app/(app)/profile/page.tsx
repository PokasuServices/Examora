"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, Lock, Pencil, ShieldCheck } from "lucide-react";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import { RetryInline } from "@/components/ui/retry-inline";
import { AutosaveIndicator } from "@/components/ui/autosave-indicator";
import { SettingsShell } from "@/components/settings/settings-shell";
import { ProfileAvatar } from "@/components/settings/profile-avatar";
import { profileCompletion, roleLabel } from "@/components/settings/format";
import { authorDisplayName } from "@/lib/format";
import { useProfile } from "@/components/settings/use-profile";

const GUARDIAN_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function QuickActionLink({
  href,
  icon: Icon,
  label,
  onClick,
}: {
  href?: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean }>;
  label: string;
  onClick?: () => void;
}) {
  const className =
    "flex flex-col items-start gap-2 rounded-md border border-neutral-900/[0.06] bg-white p-3 text-sm font-medium text-neutral-700 transition-colors hover:border-primary-200 hover:bg-primary-50/50 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500";
  if (href) {
    return (
      <Link href={href} className={className}>
        <Icon size={18} strokeWidth={1.75} aria-hidden />
        {label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      <Icon size={18} strokeWidth={1.75} aria-hidden />
      {label}
    </button>
  );
}

function ProfileContent() {
  const { status, profile, form, patch, dirty, saveStatus, saveError, save, retry } = useProfile();
  const firstNameRef = React.useRef<HTMLInputElement>(null);
  const guardianEmailValid = !form.guardianEmail || GUARDIAN_EMAIL_PATTERN.test(form.guardianEmail);

  function focusForm(): void {
    document.getElementById("personal-information")?.scrollIntoView({ behavior: "smooth" });
    firstNameRef.current?.focus();
  }

  if (status === "loading") {
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <Skeleton className="h-16 w-16 rounded-full" />
          <Skeleton className="mt-4 h-5 w-40" />
          <Skeleton className="mt-2 h-4 w-56" />
        </Card>
        <Card>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-4 h-10 w-full" />
          <Skeleton className="mt-3 h-10 w-full" />
        </Card>
      </div>
    );
  }

  if (status === "error" || !profile) {
    return <RetryInline message="Couldn't load your profile" onRetry={retry} />;
  }

  const completion = profileCompletion([
    { label: "First name", complete: Boolean(profile.firstName) },
    { label: "Last name", complete: Boolean(profile.lastName) },
    { label: "Phone", complete: Boolean(profile.phone) },
    { label: "Date of birth", complete: Boolean(profile.dateOfBirth) },
    { label: "Email verified", complete: profile.emailVerified },
  ]);

  const memberSince = new Date(profile.createdAt).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-6">
      {/* ---------- Profile Overview ---------- */}
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <ProfileAvatar user={profile} size="xl" />
            <div className="min-w-0">
              <h2 className="font-heading text-xl font-semibold text-neutral-900">
                {authorDisplayName(profile)}
              </h2>
              <p className="mt-0.5 truncate text-sm text-neutral-500">{profile.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {profile.roles.map((role) => (
                  <Chip key={role} tone="primary">
                    {roleLabel(role)}
                  </Chip>
                ))}
                <Chip tone={profile.emailVerified ? "success" : "warning"}>
                  {profile.emailVerified ? "Verified" : "Not verified"}
                </Chip>
              </div>
            </div>
          </div>
          <p className="shrink-0 text-sm text-neutral-500">Member since {memberSince}</p>
        </div>

        <div className="mt-5 border-t border-neutral-100 pt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-neutral-700">Profile completion</span>
            <span className="text-neutral-500">
              {completion.completed} of {completion.total} complete
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-primary-600 transition-all"
              style={{ width: `${completion.percent}%` }}
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <QuickActionLink icon={Pencil} label="Edit profile" onClick={focusForm} />
          <QuickActionLink icon={ShieldCheck} label="Manage security" href="/profile/security" />
          <QuickActionLink
            icon={Bell}
            label="Notification settings"
            href="/notifications/preferences"
          />
          <QuickActionLink icon={Lock} label="Privacy & consent" href="/profile/privacy" />
        </div>
      </Card>

      {/* ---------- Personal Information ---------- */}
      <Card id="personal-information">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold text-neutral-900">
            Personal information
          </h2>
          {dirty ? <Chip tone="warning">Unsaved changes</Chip> : null}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <ProfileAvatar user={profile} size="md" />
          <p className="text-xs text-neutral-500">
            Photo uploads aren&rsquo;t available yet — your initials stand in for a profile photo
            everywhere in Examora.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (guardianEmailValid) void save();
          }}
          className="mt-5 flex flex-col gap-4"
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                ref={firstNameRef}
                value={form.firstName ?? ""}
                maxLength={100}
                onChange={(e) => patch({ firstName: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                value={form.lastName ?? ""}
                maxLength={100}
                onChange={(e) => patch({ lastName: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={form.phone ?? ""}
              maxLength={20}
              onChange={(e) => patch({ phone: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dateOfBirth">Date of birth</Label>
            <Input
              id="dateOfBirth"
              type="date"
              value={form.dateOfBirth ?? ""}
              onChange={(e) => patch({ dateOfBirth: e.target.value })}
            />
          </div>

          <div className="border-t border-neutral-100 pt-4">
            <p className="text-sm font-medium text-neutral-700">Guardian (optional)</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              For students who want a guardian kept in the loop.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="guardianName">Guardian name</Label>
                <Input
                  id="guardianName"
                  value={form.guardianName ?? ""}
                  maxLength={100}
                  onChange={(e) => patch({ guardianName: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="guardianEmail">Guardian email</Label>
                <Input
                  id="guardianEmail"
                  type="email"
                  invalid={!guardianEmailValid}
                  value={form.guardianEmail ?? ""}
                  onChange={(e) => patch({ guardianEmail: e.target.value })}
                />
                {!guardianEmailValid ? <FieldError>Enter a valid email address.</FieldError> : null}
              </div>
            </div>
          </div>

          {saveStatus === "error" ? <FieldError>{saveError}</FieldError> : null}

          <div className="flex items-center gap-3 border-t border-neutral-100 pt-4">
            <Button
              type="submit"
              disabled={!dirty || saveStatus === "saving" || !guardianEmailValid}
            >
              {saveStatus === "saving" ? "Saving…" : "Save changes"}
            </Button>
            <AutosaveIndicator status={saveStatus} />
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <SettingsShell>
        <ProfileContent />
      </SettingsShell>
    </RequireAuth>
  );
}
