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
ENV NEXT_TELEMETRY_DISABLED=1
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
