# Plan: kastor-s3

> Source PRD: `PRD.md`

## Architectural decisions

Durable decisions that apply across all phases:

- **API routes:**
  - `GET /api/buckets`
  - `GET /api/buckets/:bucket/objects?prefix=`
  - `POST /api/buckets/:bucket/objects?prefix=`
  - `DELETE /api/buckets/:bucket/objects?key=`
  - `GET /api/buckets/:bucket/download?key=`
  - `GET /api/buckets/:bucket/download-folder?prefix=`
  - `GET /api/buckets/:bucket/presigned?key=`
- **Frontend routes:**
  - `/` — bucket list
  - `/buckets/:bucket?prefix=` — object browser (root and nested prefixes)
- **Key models** (defined in `shared/types.ts`, shared across API and frontend):
  - `Bucket { name: string, creationDate: string }`
  - `S3Object { key: string, size: number, lastModified: string, isPrefix: boolean }`
  - `PresignedURL { url: string }`
- **Stack:** TypeScript throughout — Bun + Hono (API), Vite + React + Mantine (frontend)
- **S3 client:** `@aws-sdk/client-s3` (AWS SDK v3)
- **Storage interface:** S3 client sits behind a `Storage` TypeScript interface; real impl in prod, fake in tests
- **No database** — fully stateless; all state lives in S3 and env vars
- **No auth** — personal tool, credentials via env vars only
- **Deployment:** Docker Compose — Bun API container (port 8080) + nginx container serving Vite build (port 80)
- **Config env vars:** `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`
- **Testing:** `bun test` for API (via `app.request()`), Vitest + RTL + MSW for frontend

---

## Phase 1: Tracer bullet — boot and list buckets

**User stories:** Docker Compose starts with one command; app connects to Storadera using env vars; bucket list is visible in the browser with real data.

### What to build

The thinnest possible end-to-end slice: `docker compose up` boots both containers, the Go API connects to Storadera and serves `GET /api/buckets`, the React frontend fetches and renders the bucket list. Nothing else needs to work — this phase purely proves the full stack is wired together correctly.

### Acceptance criteria

- [ ] `docker compose up` starts both the API and frontend containers without errors
- [ ] `GET /api/buckets` returns a JSON list of real buckets from Storadera
- [ ] The frontend renders the bucket list with real bucket names
- [ ] A missing or invalid env var produces a clear error on startup (not a silent crash)

---

## Phase 2: Object browser — list and navigate

**User stories:** Click a bucket to see its contents; objects and "folders" (common prefixes) are listed with name, size, and last modified date; navigate into a prefix; breadcrumb trail shows current path and each segment is clickable.

### What to build

Clicking a bucket navigates to `/buckets/{bucket}`. The Go API lists objects and common prefixes at the given prefix level. The frontend renders them as a file-manager-style list. Clicking a prefix navigates deeper; clicking a breadcrumb segment navigates back up. The URL (`?prefix=`) reflects the current location so the browser back button works.

### Acceptance criteria

- [ ] `GET /api/buckets/{bucket}/objects?prefix=` returns objects and prefixes at the given level
- [ ] Objects show name, size, and last modified date
- [ ] Prefixes ("folders") are visually distinct from objects
- [ ] Clicking a prefix navigates into it and updates the URL
- [ ] Breadcrumb reflects the full current path; each segment navigates to that level
- [ ] Browser back/forward buttons work correctly

---

## Phase 3: Image thumbnails

**User stories:** Image files (JPG, JPEG, PNG, GIF, WebP) in the object list show a thumbnail preview inline without requiring a full download.

### What to build

When the object list includes image files (detected by extension), the frontend requests a presigned URL from `GET /api/buckets/{bucket}/presigned?key=`. The browser fetches the image directly from Storadera using that URL — the Go API is not in the fetch path. Thumbnails are displayed inline in the object list row. Non-image files show a generic file icon instead.

### Acceptance criteria

- [ ] `GET /api/buckets/{bucket}/presigned?key=` returns a short-lived presigned URL (15-minute TTL)
- [ ] Image files in the object list display a thumbnail loaded directly from Storadera
- [ ] Non-image files display a generic icon (no broken image placeholder)
- [ ] Thumbnails are sized consistently and do not break the list layout
- [ ] Supported formats: JPG, JPEG, PNG, GIF, WebP

---

## Phase 4: Single file download

**User stories:** Click a download button on any object; the browser downloads the file to disk (not rendered inline).

### What to build

Each object row has a download button. Clicking it hits `GET /api/buckets/{bucket}/download?key=`, which streams the object from Storadera to the browser with `Content-Disposition: attachment` headers. The browser triggers a native file download.

### Acceptance criteria

- [ ] Each object row has a visible download action
- [ ] Clicking download triggers a browser file download (not inline rendering)
- [ ] The downloaded filename matches the object's key name (not a generated name)
- [ ] Large files stream correctly without buffering entirely in memory on the server

---

## Phase 5: Folder download as ZIP

**User stories:** Click download on a prefix ("folder"); the browser downloads a ZIP file containing all objects under that prefix, preserving relative path structure.

### What to build

Each prefix row has a download button. Clicking it hits `GET /api/buckets/{bucket}/download-folder?prefix=`, which recursively lists all objects under the prefix, streams them from Storadera, and writes them into a ZIP that is streamed directly to the browser. No full ZIP is buffered in memory.

### Acceptance criteria

- [ ] Each prefix row has a visible download action
- [ ] Clicking download shows an indeterminate spinner ("Preparing download…") in the UI
- [ ] Bun begins streaming the ZIP immediately; browser native download bar takes over
- [ ] Spinner clears when the request completes or errors
- [ ] Clicking download triggers a browser download of a `.zip` file
- [ ] The ZIP contains all objects under the prefix (recursive)
- [ ] Relative paths within the ZIP match the key structure under the prefix root
- [ ] The ZIP streams progressively — does not require full buffering on the server

---

## Phase 6: File upload

**User stories:** Click an upload button while inside a bucket/prefix; pick one or more files from the file picker; files are uploaded to the current prefix and appear in the object list.

### What to build

A toolbar upload button opens the browser's native file picker. Selected files are POSTed to `POST /api/buckets/{bucket}/objects?prefix=`. Upload progress is shown per file. On completion, the object list refreshes to show the newly uploaded files.

### Acceptance criteria

- [ ] An upload button is visible in the object browser toolbar on desktop
- [ ] Upload button is hidden on mobile viewports
- [ ] Clicking it opens the native file picker (single or multi-file selection)
- [ ] Files upload to the current prefix (correct key path)
- [ ] A single overall progress bar shows combined bytes sent across all selected files (implemented via XHR, not fetch)
- [ ] Progress bar reaches 100% and clears after all files complete
- [ ] The object list updates after upload completes without a full page reload
- [ ] Uploading a file with the same key as an existing object overwrites it silently (S3 default behaviour)

---

## Phase 7: Delete object

**User stories:** Click delete on an object; confirm the action; the object is removed and disappears from the list.

### What to build

Each object row has a delete button. Clicking it opens a confirmation dialog showing the object key. Confirming sends `DELETE /api/buckets/{bucket}/objects?key=`. On success, the object is removed from the list without a full page reload.

### Acceptance criteria

- [ ] Each object row has a visible delete action on desktop
- [ ] Delete action is hidden on mobile viewports
- [ ] Clicking delete opens a confirmation dialog showing the full object key
- [ ] Confirming sends the delete request and removes the object from the list
- [ ] Cancelling the dialog makes no change
- [ ] Deleting a non-existent key (e.g. race condition) is handled gracefully — no unhandled error shown to user
