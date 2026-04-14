# kastor-s3

<img src="./logo.png" alt="kastor-s3 logo" width="120" />

A personal web-based file manager for S3-compatible storage. Browse buckets, upload and download files and delete objects — all from a clean browser UI.

## Stack

| Layer      | Technology                                   |
| ---------- | -------------------------------------------- |
| Frontend   | Vite + React 19 + Mantine 7 + React Router 7 |
| Backend    | Bun + Hono 4 + AWS SDK v3                    |
| Deployment | Docker Compose (nginx + Bun API)             |

## Running

**Prerequisites:** Docker and Docker Compose.

Copy this to `.env` and fill in your credentials:

```env
S3_ENDPOINT=           # S3-compatible endpoint URL
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_REGION=
```

Then start everything:

```bash
docker-compose up --build -d
```

The app is available at `http://localhost:7778`.

## Development

Requires [Bun](https://bun.sh).

```bash
# Install dependencies
bun install

# Start backend (api/)
cd api && bun run dev

# Start frontend (frontend/)
cd frontend && bun run dev

# Lint + format (repo root)
bun run fix
```

## Testing

```bash
# Frontend (Vitest)
cd frontend && bun run test

# Backend (Bun test runner)
cd api && bun test
```

## Features

- Browse buckets and navigate object prefixes as folders
- Upload files with progress tracking
- Download single files or entire folders as ZIP
- Delete objects with confirmation
- Responsive UI — mobile is read-only; desktop has full controls
