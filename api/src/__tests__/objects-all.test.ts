import { describe, it, expect } from 'bun:test';
import { createApp } from '../app';
import { FakeStorage } from '../storage-fake';
import type { S3Object } from '@shared/types';

const fakeObjects: S3Object[] = [
  { key: 'photos/cat.jpg', size: 100, lastModified: '', isPrefix: false },
  { key: 'photos/sub/dog.jpg', size: 200, lastModified: '', isPrefix: false },
  { key: 'docs/readme.txt', size: 50, lastModified: '', isPrefix: false },
];

describe('GET /api/buckets/:bucket/objects-all', () => {
  it('returns all keys for a prefix', async () => {
    const app = createApp(new FakeStorage([], {}, { testBucket: fakeObjects }));
    const res = await app.request('/api/buckets/testBucket/objects-all?prefix=photos/');

    expect(res.status).toBe(200);
    const body = await res.json() as { keys: string[] };
    expect(body.keys).toEqual(['photos/cat.jpg', 'photos/sub/dog.jpg']);
  });

  it('returns all keys when prefix is empty', async () => {
    const app = createApp(new FakeStorage([], {}, { testBucket: fakeObjects }));
    const res = await app.request('/api/buckets/testBucket/objects-all');

    expect(res.status).toBe(200);
    const body = await res.json() as { keys: string[] };
    expect(body.keys).toEqual(['photos/cat.jpg', 'photos/sub/dog.jpg', 'docs/readme.txt']);
  });

  it('returns empty array for unknown bucket', async () => {
    const app = createApp(new FakeStorage([], {}, {}));
    const res = await app.request('/api/buckets/missing/objects-all');

    expect(res.status).toBe(200);
    const body = await res.json() as { keys: string[] };
    expect(body.keys).toEqual([]);
  });

  it('returns 500 when storage fails', async () => {
    const app = createApp(new FakeStorage([], { fail: true }));
    const res = await app.request('/api/buckets/testBucket/objects-all');

    expect(res.status).toBe(500);
  });
});
