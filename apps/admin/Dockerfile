# Build context MUST be the monorepo root:
#   docker build -f apps/admin/Dockerfile -t examora-admin .
# Image build/push is not yet wired into CI (see docs/TECHNICAL_DEBT_REGISTER.md TD-007).

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS pruner
RUN npm install -g turbo@^2.3.3
COPY . .
RUN turbo prune @examora/admin --docker

FROM base AS installer
COPY --from=pruner /repo/out/json/ .
RUN pnpm install --frozen-lockfile

FROM installer AS builder
COPY --from=pruner /repo/out/full/ .
# `turbo prune --docker` doesn't carry root-level files that aren't inside a
# workspace package (every package's tsconfig.json extends this one) — copy
# it explicitly or every tsup/next build in the graph fails with
# "TS5083: Cannot read file '/repo/tsconfig.base.json'".
COPY --from=pruner /repo/tsconfig.base.json .
ENV NEXT_TELEMETRY_DISABLED=1
# next.config.mjs only enables output:"standalone" (required by the runner
# stage below) when this is set — see next.config.mjs for why it's gated
# rather than unconditional.
ENV DOCKER_BUILD=1
# apps/admin's build script is `dotenv -e ../../.env -- next build` (a single
# .env works for local dev too — see README). .dockerignore deliberately
# excludes the real .env from the build context, so production config must
# come from real container env vars (docker run -e / compose / k8s secrets),
# never a baked-in file; this placeholder only satisfies dotenv-cli's
# requirement that the path it's given exists, mirroring ci.yml's same step.
RUN touch .env
RUN pnpm turbo run build --filter=@examora/admin...

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
WORKDIR /app

COPY --from=builder --chown=nextjs:nodejs /repo/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/admin/public ./apps/admin/public

USER nextjs
EXPOSE 3002
CMD ["node", "apps/admin/server.js"]
