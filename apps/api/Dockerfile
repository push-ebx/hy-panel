FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
COPY package.json ./
RUN corepack enable pnpm && pnpm i

FROM base AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "--import", "tsx", "src/index.ts"]
