FROM oven/bun:1-alpine AS builder
WORKDIR /app

COPY tsconfig.base.json ./
COPY shared/ ./shared/

COPY api/package.json ./api/
COPY api/tsconfig.json ./api/
WORKDIR /app/api
RUN bun install --production

WORKDIR /app
COPY frontend/package.json ./frontend/
COPY frontend/tsconfig.json ./frontend/
COPY frontend/tsconfig.build.json ./frontend/
COPY frontend/tsconfig.node.json ./frontend/
COPY frontend/vite.config.ts ./frontend/
WORKDIR /app/frontend
RUN bun install

COPY frontend/src/ ./src/
COPY frontend/public/ ./public/
COPY frontend/index.html ./
RUN bun run build

FROM nginx:alpine

RUN apk add --no-cache openssl

COPY --from=builder /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /app
COPY tsconfig.base.json ./
COPY shared/ ./shared/
COPY --from=builder /app/api/node_modules ./api/node_modules
COPY api/src/ ./api/src/
COPY api/tsconfig.json ./api/

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY nginx.conf.noauth /etc/nginx/conf.d/nginx.conf.noauth
COPY nginx.conf.auth /etc/nginx/conf.d/nginx.conf.auth

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
