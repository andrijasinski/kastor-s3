import { describe, it, expect } from 'bun:test';
import { createApp } from '../app';
import { FakeStorage } from '../storage-fake';
import type { S3Object } from '@shared/types';

const fakeObjects: S3Object[] = [
	{ key: 'docs/', size: 0, lastModified: '', isPrefix: true },
	{ key: 'readme.txt', size: 1024, lastModified: '2024-01-01T00:00:00.000Z', isPrefix: false },
];

describe('GET /api/buckets/:bucket/folder-size', () => {
	it('returns summed size of all objects under prefix', async () => {
		const objects: S3Object[] = [
			{ key: 'docs/a.txt', size: 500, lastModified: '', isPrefix: false },
			{ key: 'docs/b.txt', size: 1500, lastModified: '', isPrefix: false },
			{ key: 'other.txt', size: 9999, lastModified: '', isPrefix: false },
		];
		const app = createApp(new FakeStorage([], {}, { testBucket: objects }));
		const res = await app.request('/api/buckets/testBucket/folder-size?prefix=docs/');

		expect(res.status).toBe(200);
		const body = (await res.json()) as { size: number };
		expect(body.size).toBe(2000);
	});

	it('returns 0 for unknown bucket', async () => {
		const app = createApp(new FakeStorage([], {}, {}));
		const res = await app.request('/api/buckets/no-such-bucket/folder-size?prefix=docs/');

		expect(res.status).toBe(200);
		const body = (await res.json()) as { size: number };
		expect(body.size).toBe(0);
	});

	it('returns 500 with error message on storage failure', async () => {
		const app = createApp(new FakeStorage([], { fail: true }));
		const res = await app.request('/api/buckets/my-bucket/folder-size?prefix=docs/');

		expect(res.status).toBe(500);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('FakeStorage: forced failure');
	});
});

describe('GET /api/buckets/:bucket/objects', () => {
	it('returns 200 with objects list', async () => {
		const app = createApp(new FakeStorage([], {}, { testBucket: fakeObjects }));
		const res = await app.request('/api/buckets/testBucket/objects?prefix=');

		expect(res.status).toBe(200);
		const body = (await res.json()) as { objects: S3Object[] };
		expect(body.objects).toEqual(fakeObjects);
	});

	it('returns empty list for unknown bucket', async () => {
		const app = createApp(new FakeStorage([], {}, {}));
		const res = await app.request('/api/buckets/no-such-bucket/objects');

		expect(res.status).toBe(200);
		const body = (await res.json()) as { objects: S3Object[] };
		expect(body.objects).toEqual([]);
	});

	it('returns 500 when storage fails', async () => {
		const app = createApp(new FakeStorage([], { fail: true }));
		const res = await app.request('/api/buckets/my-bucket/objects');

		expect(res.status).toBe(500);
	});
});
