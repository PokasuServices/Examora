/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // "standalone" is required for apps/admin/Dockerfile's runner stage, which
  // copies .next/standalone (see TD-010) — but its build-trace step symlinks
  // node_modules, which fails with EPERM on a Windows host without Developer
  // Mode/admin rights. Gated behind DOCKER_BUILD (set only by the Dockerfile)
  // rather than enabled unconditionally, so `pnpm build` keeps working for
  // every contributor regardless of their machine's symlink privileges — the
  // actual Docker/CI build environment is always Linux, where this is a no-op
  // distinction (Linux containers don't have this restriction either way).
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,
  // Dev-only: keep compiled pages in memory for the whole session instead of
  // evicting them after 60s idle (default buffer: 5 pages), so navigating
  // back to a page never triggers a recompile. No effect on next build/start.
  onDemandEntries: {
    maxInactiveAge: 60 * 60 * 1000,
    pagesBufferLength: 200,
  },
};

export default nextConfig;
