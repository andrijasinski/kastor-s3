import { describe, it, expect } from 'bun:test';
import { createApp } from '../app';
import { FakeStorage } from '../storage-fake';
import type { S3Object } from '@shared/types';

const fakeObjects: S3Object[] = [
	{ key: 'photos/cat.jpg', size: 100, lastModified: '', isPrefix: false },
	{ key: 'photos/dog.jpg', size: 200, lastModified: '', isPrefix: false },
	{ key: 'docs/readme.txt', size: 50, lastModified: '', isPrefix: false },
];

describe('DELETE /api/buckets/:bucket/folder', () => {
	it('deletes all objects under prefix and returns 200', async () => {
		const storage = new FakeStorage([], {}, { testBucket: fakeObjects });
		const app = createApp(storage);
		const res = await app.request('/api/buckets/testBucket/folder?prefix=photos/', {
			method: 'DELETE',
		});

		expect(res.status).toBe(200);
		expect(storage.getDeletedKeys('testBucket')).toEqual(['photos/cat.jpg', 'photos/dog.jpg']);
	});

	it('returns 200 and deletes nothing when prefix has no objects', async () => {
		const storage = new FakeStorage([], {}, { testBucket: fakeObjects });
		const app = createApp(storage);
		const res = await app.request('/api/buckets/testBucket/folder?prefix=empty/', {
			method: 'DELETE',
		});

		expect(res.status).toBe(200);
		expect(storage.getDeletedKeys('testBucket')).toEqual([]);
	});

	it('returns 400 when prefix is missing', async () => {
		const app = createApp(new FakeStorage([], {}));
		const res = await app.request('/api/buckets/testBucket/folder', { method: 'DELETE' });

		expect(res.status).toBe(400);
	});

	it('returns 500 when storage fails', async () => {
		const app = createApp(new FakeStorage([], { fail: true }));
		const res = await app.request('/api/buckets/testBucket/folder?prefix=photos/', {
			method: 'DELETE',
		});

		expect(res.status).toBe(500);
	});
});
