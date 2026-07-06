FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm install tsx
COPY --from=builder /app/dist ./dist
COPY src/db/ ./src/db/
COPY src/config.ts ./src/config.ts
EXPOSE 3000
CMD ["sh", "-c", "npx tsx src/db/migrate.ts && node dist/index.js"]
