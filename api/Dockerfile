FROM oven/bun:1-alpine
WORKDIR /app

COPY tsconfig.base.json ./
COPY shared/ ./shared/
COPY api/package.json ./api/
COPY api/tsconfig.json ./api/

WORKDIR /app/api
RUN bun install --production

COPY api/src/ ./src/

EXPOSE 8080
CMD ["bun", "run", "src/index.ts"]
