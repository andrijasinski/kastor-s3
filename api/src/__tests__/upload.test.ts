import {describe, it, expect} from 'bun:test';
import {createApp} from '../app';
import {FakeStorage} from '../storage-fake';

const makeRequest = (bucket: string, key: string, content: string, contentType?: string) => {
	const params = new URLSearchParams({key});
	if (contentType !== undefined) {
		params.set('contentType', contentType);
	}
	return new Request(`http://localhost/api/buckets/${bucket}/upload?${params.toString()}`, {
		method: 'PUT',
		body: content,
	});
};

describe('PUT /api/buckets/:bucket/upload', () => {
	it('uploads a single file and returns 200', async () => {
		const storage = new FakeStorage([], {}, {});
		const app = createApp(storage);
		const res = await app.fetch(makeRequest('testBucket', 'hello.txt', 'hello'));

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ok: true});
		expect(storage.getUploadedKeys('testBucket')).toEqual(['hello.txt']);
	});

	it('stores object at exact key including prefix', async () => {
		const storage = new FakeStorage([], {}, {});
		const app = createApp(storage);
		await app.fetch(makeRequest('testBucket', 'docs/readme.txt', 'hi'));

		expect(storage.getUploadedKeys('testBucket')).toEqual(['docs/readme.txt']);
	});

	it('preserves nested relative path for folder uploads', async () => {
		const storage = new FakeStorage([], {}, {});
		const app = createApp(storage);
		await app.fetch(
			makeRequest('testBucket', 'uploads/photos/2024/cat.jpg', 'img', 'image/jpeg'),
		);
		await app.fetch(
			makeRequest('testBucket', 'uploads/photos/2024/dog.jpg', 'img', 'image/jpeg'),
		);

		expect(storage.getUploadedKeys('testBucket')).toEqual([
			'uploads/photos/2024/cat.jpg',
			'uploads/photos/2024/dog.jpg',
		]);
	});

	it('returns 400 when key is missing', async () => {
		const app = createApp(new FakeStorage([], {}));
		const res = await app.fetch(
			new Request('http://localhost/api/buckets/testBucket/upload', {
				method: 'PUT',
				body: 'content',
			}),
		);

		expect(res.status).toBe(400);
	});

	it('returns 400 when key is empty', async () => {
		const app = createApp(new FakeStorage([], {}));
		const res = await app.fetch(
			new Request('http://localhost/api/buckets/testBucket/upload?key=', {
				method: 'PUT',
				body: 'content',
			}),
		);

		expect(res.status).toBe(400);
	});

	it('returns 500 when storage fails', async () => {
		const app = createApp(new FakeStorage([], {fail: true}));
		const res = await app.fetch(makeRequest('testBucket', 'file.txt', 'x'));

		expect(res.status).toBe(500);
	});

	it('succeeds without contentType', async () => {
		const storage = new FakeStorage([], {}, {});
		const app = createApp(storage);
		const res = await app.fetch(makeRequest('testBucket', 'file.bin', 'data'));

		expect(res.status).toBe(200);
		expect(storage.getUploadedKeys('testBucket')).toEqual(['file.bin']);
	});
});
