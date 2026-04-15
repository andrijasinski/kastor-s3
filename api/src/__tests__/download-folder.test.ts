import {describe, it, expect} from 'bun:test';
import {createApp} from '../app';
import {FakeStorage} from '../storage-fake';
import type {S3Object} from '@shared/types';

const fakeObjects: S3Object[] = [
	{key: 'photos/cat.jpg', size: 100, lastModified: '', isPrefix: false},
	{key: 'photos/dog.jpg', size: 200, lastModified: '', isPrefix: false},
];

describe('GET /api/buckets/:bucket/download-folder', () => {
	it('returns 200 with zip content-type and correct filename', async () => {
		const app = createApp(new FakeStorage([], {}, {testBucket: fakeObjects}));
		const res = await app.request('/api/buckets/testBucket/download-folder?prefix=photos/');

		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toBe('application/zip');
		expect(res.headers.get('Content-Disposition')).toBe(
			"attachment; filename*=UTF-8''photos.zip",
		);
	});

	it('uses bucket name as filename when prefix is empty', async () => {
		const app = createApp(new FakeStorage([], {}, {testBucket: fakeObjects}));
		const res = await app.request('/api/buckets/testBucket/download-folder');

		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Disposition')).toBe(
			"attachment; filename*=UTF-8''testBucket.zip",
		);
	});

	it('response body is non-empty', async () => {
		const app = createApp(new FakeStorage([], {}, {testBucket: fakeObjects}));
		const res = await app.request('/api/buckets/testBucket/download-folder?prefix=photos/');

		const bytes = await res.arrayBuffer();
		expect(bytes.byteLength).toBeGreaterThan(0);
	});

	it('returns 500 when storage fails', async () => {
		const app = createApp(new FakeStorage([], {fail: true}));
		const res = await app.request('/api/buckets/testBucket/download-folder?prefix=photos/');

		expect(res.status).toBe(500);
	});
});
