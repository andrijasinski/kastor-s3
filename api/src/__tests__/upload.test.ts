import {describe, it, expect} from 'bun:test';
import {createApp} from '../app';
import {FakeStorage} from '../storage-fake';

const makeRequest = (
	bucket: string,
	prefix: string,
	files: Array<{name: string; content: string; type?: string}>,
) => {
	const formData = new FormData();
	for (const f of files) {
		formData.append('file', new File([f.content], f.name, {type: f.type ?? ''}));
	}
	return new Request(
		`http://localhost/api/buckets/${bucket}/upload?prefix=${encodeURIComponent(prefix)}`,
		{
			method: 'POST',
			body: formData,
		},
	);
};

describe('POST /api/buckets/:bucket/upload', () => {
	it('uploads a single file and returns 200', async () => {
		const storage = new FakeStorage([], {}, {});
		const app = createApp(storage);
		const res = await app.fetch(
			makeRequest('testBucket', '', [{name: 'hello.txt', content: 'hello'}]),
		);

		expect(res.status).toBe(200);
		expect(storage.getUploadedKeys('testBucket')).toEqual(['hello.txt']);
	});

	it('prepends prefix to key', async () => {
		const storage = new FakeStorage([], {}, {});
		const app = createApp(storage);
		await app.fetch(makeRequest('testBucket', 'docs/', [{name: 'readme.txt', content: 'hi'}]));

		expect(storage.getUploadedKeys('testBucket')).toEqual(['docs/readme.txt']);
	});

	it('preserves subfolder path for folder uploads', async () => {
		const storage = new FakeStorage([], {}, {});
		const app = createApp(storage);
		await app.fetch(
			makeRequest('testBucket', 'uploads/', [
				{name: 'photos/2024/cat.jpg', content: 'img', type: 'image/jpeg'},
				{name: 'photos/2024/dog.jpg', content: 'img', type: 'image/jpeg'},
			]),
		);

		expect(storage.getUploadedKeys('testBucket')).toEqual([
			'uploads/photos/2024/cat.jpg',
			'uploads/photos/2024/dog.jpg',
		]);
	});

	it('returns 400 with no files', async () => {
		const app = createApp(new FakeStorage([], {}));
		const formData = new FormData();
		const res = await app.fetch(
			new Request('http://localhost/api/buckets/testBucket/upload', {
				method: 'POST',
				body: formData,
			}),
		);

		expect(res.status).toBe(400);
	});

	it('returns 500 when storage fails', async () => {
		const app = createApp(new FakeStorage([], {fail: true}));
		const res = await app.fetch(
			makeRequest('testBucket', '', [{name: 'file.txt', content: 'x'}]),
		);

		expect(res.status).toBe(500);
	});
});
