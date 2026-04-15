import {describe, it, expect} from 'bun:test';
import {createApp} from '../app';
import {FakeStorage} from '../storage-fake';

describe('GET /api/buckets/:bucket/object', () => {
	it('streams object body with correct content type', async () => {
		const app = createApp(new FakeStorage([], {}));
		const res = await app.request('/api/buckets/testBucket/object?key=photos/cat.jpg');

		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toBe('application/octet-stream');
		const text = await res.text();
		expect(text).toBe('fake file content');
	});

	it('does not set Content-Disposition header', async () => {
		const app = createApp(new FakeStorage([], {}));
		const res = await app.request('/api/buckets/testBucket/object?key=photos/cat.jpg');

		expect(res.headers.get('Content-Disposition')).toBeNull();
	});

	it('returns 400 when key is missing', async () => {
		const app = createApp(new FakeStorage([], {}));
		const res = await app.request('/api/buckets/testBucket/object');

		expect(res.status).toBe(400);
	});

	it('returns 400 when key is empty', async () => {
		const app = createApp(new FakeStorage([], {}));
		const res = await app.request('/api/buckets/testBucket/object?key=');

		expect(res.status).toBe(400);
	});

	it('returns 500 when storage fails', async () => {
		const app = createApp(new FakeStorage([], {fail: true}));
		const res = await app.request('/api/buckets/testBucket/object?key=photo.jpg');

		expect(res.status).toBe(500);
	});
});
