# kastor-s3 — Design Document

Personal S3 file manager. Inspired by [cloudlena/s3manager](https://github.com/cloudlena/s3manager) — keeping its setup simplicity, replacing its UI and adding new features.

## Why not just use s3manager?

- UI is outdated
- No folder (prefix) download
- No image thumbnails
- No contemporary look

## Stack

| Layer        | Choice                         | Reason                                                       |
| ------------ | ------------------------------ | ------------------------------------------------------------ |
| Backend      | TypeScript + Bun + Hono        | Same language as frontend, shared types, single toolchain    |
| Frontend     | Vite + React + Mantine         | Batteries-included components, minimal style decisions       |
| Shared types | TypeScript (`shared/types.ts`) | One source of truth for Bucket, Object, PresignedURL         |
| Deployment   | Docker Compose                 | API container (Bun) + nginx container serving built frontend |
| S3 provider  | Storadera (AWS S3-compatible)  | Cloud-hosted, publicly reachable from browser                |

## Project layout

```
kastor-s3/
  api/          # Bun + Hono backend
  frontend/     # Vite + React + Mantine
  shared/       # Shared TypeScript types
  docker-compose.yml
```

## Features

**In scope:**

- Browse buckets, navigate objects by prefix ("folders")
- Upload files (desktop only)
- Download single files
- Download a "folder" (S3 prefix) as a ZIP stream
- Delete objects (desktop only)
- Image thumbnails (JPG, PNG, GIF, WebP) via presigned URLs — browser fetches direct from Storadera
- Responsive UI — mobile shows browse/thumbnails/download only; upload and delete are desktop-only

**Out of scope (explicit decisions):**

- Auth / login — personal tool, S3 creds via env vars
- Multi-account / multi-instance support
- Bucket create / delete — use Storadera console for that
- Drag and drop uploads
- Video or PDF previews

## API

Hono serves a JSON REST API:

```
GET    /api/buckets
GET    /api/buckets/:bucket/objects?prefix=
POST   /api/buckets/:bucket/objects?prefix=     upload file
DELETE /api/buckets/:bucket/objects?key=
GET    /api/buckets/:bucket/download?key=       single file download
GET    /api/buckets/:bucket/download-folder?prefix=   ZIP stream
GET    /api/buckets/:bucket/presigned?key=      presigned URL for thumbnail
```

## Shared types

Defined once in `shared/types.ts`, imported by both `api/` and `frontend/`:

```ts
Bucket       { name: string; creationDate: string }
S3Object     { key: string; size: number; lastModified: string; isPrefix: boolean }
PresignedURL { url: string }
```

## Testing

**Backend:** `bun test` — tests call Hono handlers directly via `app.request()`. S3 client sits behind a `Storage` interface; tests inject a fake. No real S3 calls in tests.

**Frontend:** Vitest + React Testing Library + MSW. MSW intercepts `fetch()` at the network boundary — real component behaviour, fake API responses.

## Linting

Single `eslint.config.ts` at project root covering both `api/` and `frontend/`.

Required plugins: `@typescript-eslint/eslint-plugin`, `eslint-plugin-import`, `eslint-plugin-unused-imports`

| Rule                                               | Notes                                           |
| -------------------------------------------------- | ----------------------------------------------- |
| `@typescript-eslint/no-floating-promises`          | All promises must be handled                    |
| `@typescript-eslint/no-misused-promises`           | No async callbacks where sync expected          |
| `@typescript-eslint/await-thenable`                | Only await real thenables                       |
| `@typescript-eslint/no-misused-spread`             | No spreading non-iterable values                |
| `@typescript-eslint/no-unsafe-function-type`       | Ban `Function`, use specific signatures         |
| `@typescript-eslint/no-wrapper-object-types`       | Ban `String`/`Number`/`Boolean`, use primitives |
| `@typescript-eslint/only-throw-error`              | Only throw Error instances                      |
| `@typescript-eslint/prefer-promise-reject-errors`  | Only reject with Error instances                |
| `@typescript-eslint/explicit-member-accessibility` | Explicit access modifiers on class members      |
| `@typescript-eslint/naming-convention`             | Enforced naming conventions                     |
| `@typescript-eslint/no-shadow`                     | No variable shadowing                           |
| `@typescript-eslint/unbound-method`                | Class methods must be bound before use          |
| `@typescript-eslint/no-base-to-string`             | No implicit `.toString()` on objects            |
| `@typescript-eslint/return-await`                  | Use `return await` inside try/catch             |
| `@typescript-eslint/require-array-sort-compare`    | Always pass comparator to `.sort()`             |
| `@typescript-eslint/prefer-find`                   | Use `.find()` instead of `.filter()[0]`         |
| `import/no-default-export`                         | Named exports only                              |
| `unused-imports/no-unused-imports`                 | Remove unused imports                           |
| `curly`                                            | Always use braces for control flow              |
| `eqeqeq`                                           | Always use `===`                                |
| `no-console`                                       | No console statements in production code        |
| `no-debugger`                                      | No debugger statements                          |
| `no-restricted-syntax`                             | TBD                                             |
| `id-match`                                         | TBD                                             |

## Config (env vars)

```
S3_ENDPOINT=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_REGION=
```

## Docker Compose layout

```
services:
  api:       # Bun runtime, port 8080
  frontend:  # nginx serving Vite build, port 80
```

## Reference

- s3manager: https://github.com/cloudlena/s3manager (inspiration only — no code reuse)
- S3 client: `@aws-sdk/client-s3` (AWS SDK v3, works with any S3-compatible provider)
