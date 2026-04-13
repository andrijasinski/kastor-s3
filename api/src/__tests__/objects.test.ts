import { describe, it, expect } from 'bun:test';
import { createApp } from '../app';
import { FakeStorage } from '../storage-fake';
import type { S3Object } from '@shared/types';

const fakeObjects: S3Object[] = [
  { key: 'docs/', size: 0, lastModified: '', isPrefix: true },
  { key: 'readme.txt', size: 1024, lastModified: '2024-01-01T00:00:00.000Z', isPrefix: false },
];

describe('GET /api/buckets/:bucket/objects', () => {
  it('returns 200 with objects list', async () => {
    const app = createApp(new FakeStorage([], {}, { testBucket: fakeObjects }));
    const res = await app.request('/api/buckets/testBucket/objects?prefix=');

    expect(res.status).toBe(200);
    const body = await res.json() as { objects: S3Object[] };
    expect(body.objects).toEqual(fakeObjects);
  });

  it('returns empty list for unknown bucket', async () => {
    const app = createApp(new FakeStorage([], {}, {}));
    const res = await app.request('/api/buckets/no-such-bucket/objects');

    expect(res.status).toBe(200);
    const body = await res.json() as { objects: S3Object[] };
    expect(body.objects).toEqual([]);
  });

  it('returns 500 when storage fails', async () => {
    const app = createApp(new FakeStorage([], { fail: true }));
    const res = await app.request('/api/buckets/my-bucket/objects');

    expect(res.status).toBe(500);
  });
});
