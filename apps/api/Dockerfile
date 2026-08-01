# Build context MUST be the monorepo root:
#   docker build -f apps/api/Dockerfile -t examora-api .
# Image build/push is not yet wired into CI (see docs/TECHNICAL_DEBT_REGISTER.md TD-007).

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS pruner
RUN npm install -g turbo@^2.3.3
COPY . .
RUN turbo prune @examora/api --docker

FROM base AS installer
COPY --from=pruner /repo/out/json/ .
RUN pnpm install --frozen-lockfile

FROM installer AS builder
COPY --from=pruner /repo/out/full/ .
# `turbo prune --docker` doesn't carry root-level files that aren't inside a
# workspace package (every package's tsconfig.json extends this one) — copy
# it explicitly or every tsup/nest build in the graph fails with
# "TS5083: Cannot read file '/repo/tsconfig.base.json'".
COPY --from=pruner /repo/tsconfig.base.json .
RUN pnpm --filter @examora/database generate
RUN pnpm turbo run build --filter=@examora/api...

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
WORKDIR /repo

COPY --from=builder --chown=nestjs:nodejs /repo .
USER nestjs

EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
