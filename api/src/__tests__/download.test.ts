import { describe, it, expect } from 'bun:test';
import { createApp } from '../app';
import { FakeStorage } from '../storage-fake';

describe('GET /api/buckets/:bucket/download', () => {
	it('streams object with correct headers', async () => {
		const app = createApp(new FakeStorage([], {}));
		const res = await app.request('/api/buckets/testBucket/download?key=photos/cat.jpg');

		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Disposition')).toBe("attachment; filename*=UTF-8''cat.jpg");
		expect(res.headers.get('Content-Type')).toBe('application/octet-stream');
		const text = await res.text();
		expect(text).toBe('fake file content');
	});

	it('uses full key as filename when no slash present', async () => {
		const app = createApp(new FakeStorage([], {}));
		const res = await app.request('/api/buckets/testBucket/download?key=archive.zip');

		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Disposition')).toBe(
			"attachment; filename*=UTF-8''archive.zip",
		);
	});

	it('returns 400 when key is missing', async () => {
		const app = createApp(new FakeStorage([], {}));
		const res = await app.request('/api/buckets/testBucket/download');

		expect(res.status).toBe(400);
	});

	it('returns 500 when storage fails', async () => {
		const app = createApp(new FakeStorage([], { fail: true }));
		const res = await app.request('/api/buckets/testBucket/download?key=photo.jpg');

		expect(res.status).toBe(500);
	});
});
