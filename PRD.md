# kastor-s3 — Product Requirements Document

## 1. Overview

kastor-s3 is a personal, web-based file manager for S3-compatible object storage. It provides a clean, contemporary browser UI for browsing, uploading, downloading, and deleting objects — without needing CLI tools or the storage provider's console.

**Primary user:** Single user (personal tool)  
**Target storage:** Storadera (AWS S3-compatible, cloud-hosted)

---

## 2. Problem Statement

Existing S3 GUI tools (e.g. s3manager) have good setup simplicity but fall short on:

- Outdated UI
- No way to download an entire "folder" (key prefix) at once
- No image previews when browsing files
- No contemporary file manager feel

---

## 3. Goals

| Goal             | Description                                         |
| ---------------- | --------------------------------------------------- |
| Fast setup       | Single `docker compose up` to run locally           |
| Object browsing  | Navigate S3 buckets and prefixes like a file system |
| File operations  | Upload, download, delete objects                    |
| Folder download  | Download all objects under a prefix as a ZIP        |
| Image thumbnails | Preview images inline without downloading them      |
| Modern UI        | Clean, contemporary look with minimal visual noise  |

## 4. Non-Goals

The following are explicitly out of scope:

- **Authentication / login** — personal tool, no access control needed
- **Bucket management** — no create/delete buckets; use Storadera console
- **Multi-account support** — single S3 account only
- **Drag and drop uploads** — standard file picker is sufficient for now
- **Video or PDF previews** — images only

---

## 5. Functional Requirements

### 5.1 Bucket Browser

- List all buckets accessible with the configured credentials
- Select a bucket to browse its contents

### 5.2 Object Browser

- Display objects and common prefixes ("folders") at the current prefix level
- Navigate into prefixes (breadcrumb trail showing current path)
- Show for each object: name, size, last modified date
- Detect image files by extension and show a thumbnail inline
- Supported image formats for thumbnails: JPG, JPEG, PNG, GIF, WebP

### 5.3 File Upload

- Upload one or more files to the current prefix
- Standard file picker (no drag and drop required)
- Single overall progress bar showing combined bytes sent across all selected files (via XHR)

### 5.4 File Download

- Download a single object to the user's machine
- Trigger browser file download (not inline rendering)

### 5.5 Folder Download

- Select a prefix ("folder") and download all objects under it as a single ZIP file
- ZIP is streamed by the backend — no full buffering in memory
- ZIP preserves relative path structure within the prefix
- UI shows an indeterminate spinner ("Preparing download…") while the stream begins; browser native download bar takes over once bytes are flowing

### 5.6 Object Deletion

- Delete a single object
- Confirm before deleting

### 5.7 Image Thumbnails

- When listing objects, detect image files by extension
- Backend generates a short-lived presigned URL per image
- Browser fetches thumbnail directly from Storadera using presigned URL (backend not in the fetch path)
- Presigned URL TTL: 15 minutes

### 5.8 Mobile Experience

The UI is responsive. On mobile viewports the feature set is intentionally reduced to a read/download-only experience:

**Available on mobile:**

- Browse buckets and navigate object prefixes
- Image thumbnail previews
- Select individual files or folders for download
- Single file download
- Folder download as ZIP

**Hidden on mobile (desktop only):**

- File upload
- Object deletion

---

## 6. Non-Functional Requirements

- **Single startup command:** `docker compose up`
- **No persistent storage:** stateless — all state lives in S3 and env vars
- **Config via env vars only:** no config files, no database
- **Reasonable performance:** object listing should feel fast for up to ~1000 objects per prefix

---

## 7. Configuration

All configuration via environment variables:

| Variable               | Description                                     | Required |
| ---------------------- | ----------------------------------------------- | -------- |
| `S3_ENDPOINT`          | S3-compatible endpoint URL                      | Yes      |
| `S3_ACCESS_KEY_ID`     | Access key ID                                   | Yes      |
| `S3_SECRET_ACCESS_KEY` | Secret access key                               | Yes      |
| `S3_REGION`            | Storage region                                  | Yes      |
| `S3_SSL_ENABLED`       | Enable SSL (default: `true`)                    | No       |
| `S3_FORCE_DOWNLOAD`    | Force file download vs inline (default: `true`) | No       |

---

## 8. API

The Go backend exposes a JSON REST API consumed by the frontend.

| Method   | Path                                            | Description                       |
| -------- | ----------------------------------------------- | --------------------------------- |
| `GET`    | `/api/buckets`                                  | List all buckets                  |
| `GET`    | `/api/buckets/{bucket}/objects?prefix=`         | List objects and prefixes at path |
| `POST`   | `/api/buckets/{bucket}/objects?prefix=`         | Upload a file                     |
| `DELETE` | `/api/buckets/{bucket}/objects?key=`            | Delete an object                  |
| `GET`    | `/api/buckets/{bucket}/download?key=`           | Download a single object          |
| `GET`    | `/api/buckets/{bucket}/download-folder?prefix=` | Download prefix as ZIP            |
| `GET`    | `/api/buckets/{bucket}/presigned?key=`          | Get presigned URL for a thumbnail |

---

## 9. Architecture

```
┌─────────────────────────────────────────┐
│              docker compose             │
│                                         │
│  ┌──────────────┐   ┌────────────────┐  │
│  │   frontend   │   │      api       │  │
│  │              │   │                │  │
│  │  nginx       │──▶│  Go binary     │  │
│  │  serving     │   │  port 8080     │  │
│  │  Vite build  │   │                │  │
│  │  port 80     │   └───────┬────────┘  │
│  └──────────────┘           │           │
│                             │           │
└─────────────────────────────┼───────────┘
                              │ S3 API
                              ▼
                        Storadera (S3)
                              ▲
                              │ presigned URLs
                        browser (thumbnails)
```

**Frontend:** Vite + React + Mantine  
**Backend:** Go  
**S3 client:** minio-go (same as s3manager)

### Code reuse from s3manager

The following files from [cloudlena/s3manager](https://github.com/cloudlena/s3manager) are candidates for adaptation:

- `get_object.go` — single object download
- `create_object.go` — file upload
- `delete_object.go` — object deletion
- `bulk_operations.go` — ZIP folder download
- `generate_presigned_url.go` — presigned URL generation

Template handlers, view files, and multi-instance wiring are not reused.

---

## 10. UI Requirements

- **Component library:** Mantine — chosen for batteries-included defaults, minimal style decisions
- **Style:** Clean, minimal, contemporary (2026-era design sensibility)
- **Layout:** Two-panel file manager feel — bucket list on the left or top nav, object browser as main content
- **Thumbnails:** Displayed inline in the object list for image files
- **Breadcrumb navigation:** Show current bucket + prefix path, each segment clickable
- **Responsive:** Mobile-friendly layout; upload and delete controls hidden on mobile viewports

---

## 11. Out of Scope for v1 (Potential Future Work)

- Drag and drop uploads
- Folder (directory) upload preserving structure
- Rename objects
- Copy / move objects between prefixes or buckets
- Video thumbnail previews
- PDF first-page preview
- Multi-account / multi-instance support
- Search across objects
- Sharing / public link generation
