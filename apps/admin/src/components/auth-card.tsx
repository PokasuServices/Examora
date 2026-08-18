export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="flex items-center gap-2 pb-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-600 text-sm font-bold text-white">
          E
        </span>
        <span className="font-heading text-lg font-bold text-neutral-900">
          Examora <span className="font-normal text-neutral-400">Admin</span>
        </span>
      </div>
      <div className="rounded-card border border-neutral-900/[0.06] bg-white p-8 shadow-soft">
        <h1 className="text-heading">{title}</h1>
        {description ? <p className="mt-1 text-sm text-neutral-600">{description}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
