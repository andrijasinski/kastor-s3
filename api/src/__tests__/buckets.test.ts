import { describe, it, expect } from 'bun:test';
import { createApp } from '../app';
import { FakeStorage } from '../storage-fake';
import type { Bucket } from '@shared/types';

const fakeBuckets: Bucket[] = [
  { name: 'my-bucket', creationDate: '2024-01-01T00:00:00.000Z' },
  { name: 'another-bucket', creationDate: '2024-02-01T00:00:00.000Z' },
];

describe('GET /api/buckets', () => {
  it('returns 200 with bucket list', async () => {
    const app = createApp(new FakeStorage(fakeBuckets));
    const res = await app.request('/api/buckets');

    expect(res.status).toBe(200);
    const body = await res.json() as { buckets: Bucket[] };
    expect(body.buckets).toEqual(fakeBuckets);
  });

  it('returns 500 when storage fails', async () => {
    const app = createApp(new FakeStorage([], { fail: true }));
    const res = await app.request('/api/buckets');

    expect(res.status).toBe(500);
  });
});
