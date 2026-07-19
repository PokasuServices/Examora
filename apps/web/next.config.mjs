/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // output: "standalone" is required for apps/web/Dockerfile's runner stage but
  // its build-trace symlinking fails on Windows without Developer Mode/admin
  // rights (see docs/TECHNICAL_DEBT_REGISTER.md TD-010). Re-enable when Docker
  // image builds are actually exercised (TD-007) — Linux CI/containers are unaffected.
};

export default nextConfig;
