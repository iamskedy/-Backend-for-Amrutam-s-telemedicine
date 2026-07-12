# ---- Build stage ----
FROM node:20-alpine3.20 AS build
WORKDIR /app

# Update system packages to patch vulnerabilities
RUN apk update && apk upgrade

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Runtime stage ----
FROM node:20-alpine3.20 AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Update system packages to patch vulnerabilities
RUN apk update && apk upgrade

# Non-root user — don't run the app as root inside the container.
RUN addgroup -g 1001 -S nodejs && adduser -S amrutam -u 1001

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

USER amrutam

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "require('http').get('http://localhost:3000/health/live', r => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "dist/server.js"]