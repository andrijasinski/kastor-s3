import {describe, it, expect} from 'bun:test';
import {createApp} from '../app';
import {FakeStorage} from '../storage-fake';

describe('POST /api/buckets/:bucket/multipart/create', () => {
	it('returns uploadId for valid key', async () => {
		const app = createApp(new FakeStorage([], {}));
		const res = await app.fetch(
			new Request('http://localhost/api/buckets/my-bucket/multipart/create?key=file.txt', {
				method: 'POST',
			}),
		);

		expect(res.status).toBe(200);
		const data = (await res.json()) as {uploadId: string};
		expect(typeof data.uploadId).toBe('string');
		expect(data.uploadId.length).toBeGreaterThan(0);
	});

	it('returns 400 when key is missing', async () => {
		const app = createApp(new FakeStorage([], {}));
		const res = await app.fetch(
			new Request('http://localhost/api/buckets/my-bucket/multipart/create', {
				method: 'POST',
			}),
		);
		expect(res.status).toBe(400);
	});

	it('returns 500 when storage fails', async () => {
		const app = createApp(new FakeStorage([], {fail: true}));
		const res = await app.fetch(
			new Request('http://localhost/api/buckets/my-bucket/multipart/create?key=file.txt', {
				method: 'POST',
			}),
		);
		expect(res.status).toBe(500);
	});
});

describe('PUT /api/buckets/:bucket/multipart/part', () => {
	it('returns etag for valid part', async () => {
		const storage = new FakeStorage([], {});
		const app = createApp(storage);
		const uploadId = await storage.createMultipartUpload('my-bucket', 'file.txt');

		const res = await app.fetch(
			new Request(
				`http://localhost/api/buckets/my-bucket/multipart/part?key=file.txt&uploadId=${uploadId}&partNumber=1`,
				{method: 'PUT', body: 'chunk data'},
			),
		);

		expect(res.status).toBe(200);
		const data = (await res.json()) as {etag: string};
		expect(typeof data.etag).toBe('string');
	});

	it('returns 400 when parameters are missing', async () => {
		const app = createApp(new FakeStorage([], {}));
		const res = await app.fetch(
			new Request('http://localhost/api/buckets/my-bucket/multipart/part?key=file.txt', {
				method: 'PUT',
				body: 'data',
			}),
		);
		expect(res.status).toBe(400);
	});

	it('returns 400 for invalid partNumber', async () => {
		const app = createApp(new FakeStorage([], {}));
		const res = await app.fetch(
			new Request(
				'http://localhost/api/buckets/my-bucket/multipart/part?key=file.txt&uploadId=x&partNumber=0',
				{method: 'PUT', body: 'data'},
			),
		);
		expect(res.status).toBe(400);
	});
});

describe('POST /api/buckets/:bucket/multipart/complete', () => {
	it('completes upload and returns 200', async () => {
		const storage = new FakeStorage([], {});
		const app = createApp(storage);
		const uploadId = await storage.createMultipartUpload('my-bucket', 'file.txt');

		const res = await app.fetch(
			new Request(
				`http://localhost/api/buckets/my-bucket/multipart/complete?key=file.txt&uploadId=${uploadId}`,
				{
					method: 'POST',
					body: JSON.stringify({parts: [{partNumber: 1, etag: '"abc"'}]}),
				},
			),
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ok: true});
		expect(storage.getUploadedKeys('my-bucket')).toEqual(['file.txt']);
	});

	it('returns 400 when uploadId is missing', async () => {
		const app = createApp(new FakeStorage([], {}));
		const res = await app.fetch(
			new Request('http://localhost/api/buckets/my-bucket/multipart/complete?key=file.txt', {
				method: 'POST',
				body: JSON.stringify({parts: []}),
			}),
		);
		expect(res.status).toBe(400);
	});
});

describe('DELETE /api/buckets/:bucket/multipart', () => {
	it('aborts upload and returns 200', async () => {
		const storage = new FakeStorage([], {});
		const app = createApp(storage);
		const uploadId = await storage.createMultipartUpload('my-bucket', 'file.txt');

		const res = await app.fetch(
			new Request(
				`http://localhost/api/buckets/my-bucket/multipart?key=file.txt&uploadId=${uploadId}`,
				{method: 'DELETE'},
			),
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ok: true});
	});

	it('returns 400 when key is missing', async () => {
		const app = createApp(new FakeStorage([], {}));
		const res = await app.fetch(
			new Request('http://localhost/api/buckets/my-bucket/multipart?uploadId=x', {
				method: 'DELETE',
			}),
		);
		expect(res.status).toBe(400);
	});
});
