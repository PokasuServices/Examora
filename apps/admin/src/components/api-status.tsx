/** Sprint 0 wiring proof — confirms apps/admin can reach apps/api. Remove once a real dashboard exists. */
async function checkApiHealth(): Promise<"healthy" | "unreachable"> {
  const origin = process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3001";
  try {
    const res = await fetch(`${origin}/health/live`, { cache: "no-store" });
    return res.ok ? "healthy" : "unreachable";
  } catch {
    return "unreachable";
  }
}

export async function ApiStatus() {
  const status = await checkApiHealth();
  const isHealthy = status === "healthy";

  return (
    <span
      className={
        "inline-flex items-center gap-2 rounded-md px-3 py-1 text-sm font-medium " +
        (isHealthy ? "bg-success-500/10 text-success-600" : "bg-error-500/10 text-error-600")
      }
    >
      <span
        className={"h-2 w-2 rounded-full " + (isHealthy ? "bg-success-500" : "bg-error-500")}
        aria-hidden
      />
      API: {status}
    </span>
  );
}
