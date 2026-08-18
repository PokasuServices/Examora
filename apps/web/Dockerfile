# Build context MUST be the monorepo root:
#   docker build -f apps/web/Dockerfile -t examora-web .
# Image build/push is not yet wired into CI (see docs/TECHNICAL_DEBT_REGISTER.md TD-007).

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS pruner
RUN npm install -g turbo@^2.3.3
COPY . .
RUN turbo prune @examora/web --docker

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
# apps/web's build script is `dotenv -e ../../.env -- next build` (a single
# .env works for local dev too — see README). .dockerignore deliberately
# excludes the real .env from the build context; this placeholder only
# satisfies dotenv-cli's requirement that the path it's given exists,
# mirroring ci.yml's same step.
RUN touch .env

# Next.js inlines NEXT_PUBLIC_* values into the client bundle at build time,
# not at container start — `docker run -e` has no effect on them (TD-049).
# Pass real values with `--build-arg` at image-build time, e.g.:
#   docker build -f apps/web/Dockerfile \
#     --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api/v1 \
#     --build-arg NEXT_PUBLIC_API_ORIGIN=https://api.example.com \
#     --build-arg NEXT_PUBLIC_ADMIN_ORIGIN=https://admin.example.com \
#     --build-arg NEXT_PUBLIC_VAPID_PUBLIC_KEY=... .
# All four are browser-exposed by design (public API base URLs and a VAPID
# *public* key) — never pass a secret through a NEXT_PUBLIC_* build arg.
# Unset args default to the local dev values so `docker build` with no
# --build-arg still produces a working local-network image.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
ARG NEXT_PUBLIC_API_ORIGIN=http://localhost:3001
ARG NEXT_PUBLIC_ADMIN_ORIGIN=http://localhost:3002
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_ORIGIN=$NEXT_PUBLIC_API_ORIGIN
ENV NEXT_PUBLIC_ADMIN_ORIGIN=$NEXT_PUBLIC_ADMIN_ORIGIN
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

RUN pnpm turbo run build --filter=@examora/web...

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
WORKDIR /app

COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
