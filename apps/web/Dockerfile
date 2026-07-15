# ============================================================
# Sismo Voluntarios Web — Production (Next.js standalone)
# ============================================================
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --ignore-scripts --legacy-peer-deps

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WEB_ORIGIN
ARG NEXT_PUBLIC_BASE_PATH
ARG SISMO_WEB_PORT=3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WEB_ORIGIN=$NEXT_PUBLIC_WEB_ORIGIN
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
# URL del endpoint JSON de navegación del SEP (leída en runtime por el layout).
ENV SEP_NAVIGATION_URL=${SEP_NAVIGATION_URL:-}
RUN npm run build

FROM node:22-alpine AS production
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
USER nextjs
# Puerto abstracto: se puede sobreescribir con SISMO_WEB_PORT
ARG SISMO_WEB_PORT=3000
ENV PORT=$SISMO_WEB_PORT
# basePath (build-time) también se usa en runtime para el healthcheck, porque
# /login queda bajo la ruta base cuando SISMO se sirve en un sub-path del SEP.
ARG NEXT_PUBLIC_BASE_PATH
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
# Runtime: el layout del web lee SEP_NAVIGATION_URL para el sidebar.
ENV SEP_NAVIGATION_URL=${SEP_NAVIGATION_URL:-}
EXPOSE 3000
ENV HOSTNAME="0.0.0.0"
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:${SISMO_WEB_PORT:-3000}${NEXT_PUBLIC_BASE_PATH}/login || exit 1
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
