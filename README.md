# kastor-s3

<img src="./logo.png" alt="kastor-s3 logo" width="120" />

A personal web-based file manager for S3-compatible storage. Browse buckets, upload and download files and delete objects — all from a clean browser UI.

## Stack

| Layer      | Technology                                   |
| ---------- | -------------------------------------------- |
| Frontend   | Vite + React 19 + Mantine 7 + React Router 7 |
| Backend    | Bun + Hono 4 + AWS SDK v3                    |
| Deployment | Single Docker image (nginx + Bun API)        |

## Running

**Prerequisites:** Docker.

```bash
docker run -p 7778:80 \
  -e S3_ACCESS_KEY_ID=<key> \
  -e S3_SECRET_ACCESS_KEY=<secret> \
  -e S3_ENDPOINT=<endpoint> \
  -e S3_REGION=<region> \
  projectionist/kastor-s3
```

The app is available at `http://localhost:7778`.

### Environment variables

| Variable               | Description                |
| ---------------------- | -------------------------- |
| `S3_ACCESS_KEY_ID`     | S3 access key              |
| `S3_SECRET_ACCESS_KEY` | S3 secret key              |
| `S3_ENDPOINT`          | S3-compatible endpoint URL |
| `S3_REGION`            | S3 region                  |

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
- Upload files or entire folders with progress tracking
- Download single files or entire folders as ZIP
- Delete objects and folders with confirmation
- Preview files inline - images are rendered
- Gallery view for image-heavy folders
- Navigate between files with prev/next arrows in the preview page
- Calculate folder size on demand
- Responsive UI — mobile is read-only; desktop has full controls
