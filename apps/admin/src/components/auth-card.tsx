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
      <div className="rounded-lg border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-heading">{title}</h1>
        {description ? <p className="mt-1 text-sm text-neutral-600">{description}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
