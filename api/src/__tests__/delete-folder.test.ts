import {describe, it, expect} from 'bun:test';
import {createApp} from '../app';
import {FakeStorage} from '../storage-fake';
import type {S3Object} from '@shared/types';
import type {DeleteFailure} from '../errors';

const fakeObjects: S3Object[] = [
	{key: 'photos/cat.jpg', size: 100, lastModified: '', isPrefix: false},
	{key: 'photos/dog.jpg', size: 200, lastModified: '', isPrefix: false},
	{key: 'docs/readme.txt', size: 50, lastModified: '', isPrefix: false},
];

describe('DELETE /api/buckets/:bucket/folder', () => {
	it('deletes all objects under prefix and returns 200', async () => {
		const storage = new FakeStorage([], {}, {testBucket: fakeObjects});
		const app = createApp(storage);
		const res = await app.request('/api/buckets/testBucket/folder?prefix=photos/', {
			method: 'DELETE',
		});

		expect(res.status).toBe(200);
		expect(storage.getDeletedKeys('testBucket')).toEqual(['photos/cat.jpg', 'photos/dog.jpg']);
	});

	it('returns 200 and deletes nothing when prefix has no objects', async () => {
		const storage = new FakeStorage([], {}, {testBucket: fakeObjects});
		const app = createApp(storage);
		const res = await app.request('/api/buckets/testBucket/folder?prefix=empty/', {
			method: 'DELETE',
		});

		expect(res.status).toBe(200);
		expect(storage.getDeletedKeys('testBucket')).toEqual([]);
	});

	it('returns 400 when prefix is missing', async () => {
		const app = createApp(new FakeStorage([], {}));
		const res = await app.request('/api/buckets/testBucket/folder', {method: 'DELETE'});

		expect(res.status).toBe(400);
	});

	it('returns 500 when storage fails', async () => {
		const app = createApp(new FakeStorage([], {fail: true}));
		const res = await app.request('/api/buckets/testBucket/folder?prefix=photos/', {
			method: 'DELETE',
		});

		expect(res.status).toBe(500);
	});

	it('returns 207 with failedKeys on partial failure', async () => {
		const storage = new FakeStorage(
			[],
			{failKeys: new Set(['photos/cat.jpg'])},
			{testBucket: fakeObjects},
		);
		const app = createApp(storage);
		const res = await app.request('/api/buckets/testBucket/folder?prefix=photos/', {
			method: 'DELETE',
		});

		expect(res.status).toBe(207);
		const body = (await res.json()) as {error: string; failedKeys: DeleteFailure[]};
		expect(body.error).toBe('Some objects failed to delete');
		expect(body.failedKeys).toHaveLength(1);
		expect(body.failedKeys[0]?.key).toBe('photos/cat.jpg');
		expect(body.failedKeys[0]?.code).toBe('AccessDenied');
	});

	it('still records successful deletions on partial failure', async () => {
		const storage = new FakeStorage(
			[],
			{failKeys: new Set(['photos/cat.jpg'])},
			{testBucket: fakeObjects},
		);
		const app = createApp(storage);
		await app.request('/api/buckets/testBucket/folder?prefix=photos/', {method: 'DELETE'});

		expect(storage.getDeletedKeys('testBucket')).toEqual(['photos/dog.jpg']);
	});

	it('FakeStorage partial failure does not affect keys outside failKeys', async () => {
		const storage = new FakeStorage(
			[],
			{failKeys: new Set(['photos/cat.jpg'])},
			{testBucket: fakeObjects},
		);
		await storage
			.deleteObjects('testBucket', ['photos/cat.jpg', 'photos/dog.jpg'])
			.catch(() => {
				// expected partial failure
			});
		expect(storage.getDeletedKeys('testBucket')).toEqual(['photos/dog.jpg']);
	});
});
