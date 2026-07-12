# ---- Build stage ----
FROM node:20-alpine3.21 AS build
WORKDIR /app

# Update system packages to patch vulnerabilities
RUN apk update && apk upgrade --no-cache

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Runtime stage ----
FROM node:20-alpine3.21 AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Update system packages to patch vulnerabilities
RUN apk update && apk upgrade --no-cache

# Non-root user — don't run the app as root inside the container.
RUN addgroup -g 1001 -S nodejs && adduser -S amrutam -u 1001

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Remove the npm CLI and its bundled dependencies from the final image.
# The runtime only ever runs `node dist/server.js` — npm/npx/corepack are
# build-time tools, not runtime ones. Trivy flags known CVEs in npm's own
# bundled deps (cross-spawn, glob, minimatch, sigstore, tar); since we
# never invoke npm at runtime, the safest and simplest fix is to not ship it.
RUN rm -rf /usr/local/lib/node_modules/npm \
    /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

USER amrutam

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "require('http').get('http://localhost:3000/health/live', r => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "dist/server.js"]