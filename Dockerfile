# ==========================================
# Dockerfile - Creature Chess Full Stack
# ==========================================

FROM node:18-alpine AS base

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat python3 make g++

COPY . .

RUN cp .env .env.example

RUN yarn install && yarn workspace @creature-chess/rl-bot build && yarn workspace @creature-chess/tactical-ai build

RUN cd modules/@cc-server/data && yarn prisma generate && cd ../../..

EXPOSE 8090 3002 3001

CMD ["yarn", "dev-all"]
