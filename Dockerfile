# ── Stage 1: Build ─────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json ./
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/

RUN npm install

COPY tsconfig.json ./
COPY packages/server/ packages/server/
COPY packages/web/ packages/web/

RUN npm run build

# ── Stage 2: Runtime ───────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/

RUN npm install --omit=dev

COPY --from=build /app/packages/server/dist packages/server/dist
COPY --from=build /app/packages/web/dist packages/web/dist

RUN mkdir -p /app/data

VOLUME /app/data

EXPOSE 7823

CMD ["node", "packages/server/dist/index.js"]
