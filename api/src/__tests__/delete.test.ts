import { describe, it, expect } from 'bun:test';
import { createApp } from '../app';
import { FakeStorage } from '../storage-fake';

describe('DELETE /api/buckets/:bucket/object', () => {
	it('deletes an object and returns 200', async () => {
		const storage = new FakeStorage([], {}, {});
		const app = createApp(storage);
		const res = await app.request('/api/buckets/testBucket/object?key=photos/cat.jpg', {
			method: 'DELETE',
		});

		expect(res.status).toBe(200);
		expect(storage.getDeletedKeys('testBucket')).toEqual(['photos/cat.jpg']);
	});

	it('returns 400 when key is missing', async () => {
		const app = createApp(new FakeStorage([], {}));
		const res = await app.request('/api/buckets/testBucket/object', { method: 'DELETE' });

		expect(res.status).toBe(400);
	});

	it('returns 500 when storage fails', async () => {
		const app = createApp(new FakeStorage([], { fail: true }));
		const res = await app.request('/api/buckets/testBucket/object?key=file.txt', {
			method: 'DELETE',
		});

		expect(res.status).toBe(500);
	});
});
