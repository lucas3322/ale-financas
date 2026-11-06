# syntax=docker/dockerfile:1

# ---------- Frontend ----------
FROM node:22-alpine AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ---------- Backend ----------
FROM node:22-alpine AS server
RUN apk add --no-cache openssl
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
RUN npm run build && npm prune --omit=dev

# ---------- Runtime ----------
FROM node:22-alpine
RUN apk add --no-cache openssl tini
ENV NODE_ENV=production
WORKDIR /app/server
COPY --from=server /app/server/node_modules ./node_modules
COPY --from=server /app/server/dist ./dist
COPY --from=server /app/server/prisma ./prisma
COPY --from=server /app/server/package.json ./
COPY --from=web /app/web/dist /app/web/dist
ENV WEB_DIR=/app/web/dist
USER node
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
# Aplica as migrations pendentes e sobe a API (que também serve o frontend).
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
