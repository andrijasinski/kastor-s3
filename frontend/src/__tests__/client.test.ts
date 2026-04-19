import {afterAll, afterEach, beforeAll, describe, expect, it} from 'vitest';
import {http, HttpResponse} from 'msw';
import {setupServer} from 'msw/node';
import {fetchBuckets, fetchFolderSize, fetchObjects} from '../api/client';
import type {Bucket, S3Object} from '@shared/types';

const mockBuckets: Bucket[] = [
	{name: 'my-bucket', creationDate: '2024-01-01T00:00:00.000Z', region: 'us-east-1'},
	{name: 'other-bucket', creationDate: '2024-02-01T00:00:00.000Z', region: 'eu-west-1'},
];

const mockObjects: S3Object[] = [
	{key: 'docs/', size: 0, lastModified: '', isPrefix: true},
	{key: 'readme.txt', size: 1024, lastModified: '2024-01-01T00:00:00.000Z', isPrefix: false},
];

const server = setupServer(
	http.get('/api/buckets', () => HttpResponse.json({buckets: mockBuckets})),
	http.get('/api/buckets/:bucket/objects', () =>
		HttpResponse.json({objects: mockObjects, totalCount: mockObjects.length}),
	),
	http.get('/api/buckets/:bucket/folder-size', () => HttpResponse.json({size: 4096})),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('fetchBuckets', () => {
	it('returns bucket list on success', async () => {
		const result = await fetchBuckets();
		expect(result).toEqual(mockBuckets);
	});

	it('throws on non-ok response', async () => {
		server.use(http.get('/api/buckets', () => new HttpResponse(null, {status: 500})));
		await expect(fetchBuckets()).rejects.toThrow('Failed to fetch buckets: 500');
	});
});

describe('fetchObjects', () => {
	it('returns objects and totalCount on success', async () => {
		const result = await fetchObjects('my-bucket', '');
		expect(result).toEqual({objects: mockObjects, totalCount: 2});
	});

	it('sends offset and limit in URL', async () => {
		let capturedUrl = '';
		server.use(
			http.get('/api/buckets/:bucket/objects', ({request}) => {
				capturedUrl = request.url;
				return HttpResponse.json({objects: [], totalCount: 0});
			}),
		);
		await fetchObjects('my-bucket', '', 50, 100);
		expect(capturedUrl).toContain('offset=50');
		expect(capturedUrl).toContain('limit=100');
	});

	it('defaults to offset=0 limit=100', async () => {
		let capturedUrl = '';
		server.use(
			http.get('/api/buckets/:bucket/objects', ({request}) => {
				capturedUrl = request.url;
				return HttpResponse.json({objects: [], totalCount: 0});
			}),
		);
		await fetchObjects('my-bucket', '');
		expect(capturedUrl).toContain('offset=0');
		expect(capturedUrl).toContain('limit=100');
	});

	it('encodes bucket name in URL', async () => {
		let capturedUrl = '';
		server.use(
			http.get('/api/buckets/:bucket/objects', ({request}) => {
				capturedUrl = request.url;
				return HttpResponse.json({objects: [], totalCount: 0});
			}),
		);
		await fetchObjects('my bucket', 'some/prefix/');
		expect(capturedUrl).toContain('my%20bucket');
		expect(capturedUrl).toContain('prefix=some%2Fprefix%2F');
	});

	it('throws on non-ok response', async () => {
		server.use(
			http.get('/api/buckets/:bucket/objects', () => new HttpResponse(null, {status: 404})),
		);
		await expect(fetchObjects('my-bucket', '')).rejects.toThrow('Failed to fetch objects: 404');
	});
});

describe('fetchFolderSize', () => {
	it('returns folder size on success', async () => {
		const result = await fetchFolderSize('my-bucket', 'docs/');
		expect(result).toBe(4096);
	});

	it('encodes bucket name and prefix in URL', async () => {
		let capturedUrl = '';
		server.use(
			http.get('/api/buckets/:bucket/folder-size', ({request}) => {
				capturedUrl = request.url;
				return HttpResponse.json({size: 0});
			}),
		);
		await fetchFolderSize('my bucket', 'my folder/');
		expect(capturedUrl).toContain('my%20bucket');
		// URLSearchParams encodes spaces as '+' in query strings
		expect(capturedUrl).toContain('prefix=my+folder%2F');
	});

	it('throws with error message from response body on failure', async () => {
		server.use(
			http.get('/api/buckets/:bucket/folder-size', () =>
				HttpResponse.json({error: 'bucket not found'}, {status: 404}),
			),
		);
		await expect(fetchFolderSize('my-bucket', 'docs/')).rejects.toThrow('bucket not found');
	});

	it('throws with status fallback when no error message in body', async () => {
		server.use(
			http.get('/api/buckets/:bucket/folder-size', () =>
				HttpResponse.json({}, {status: 500}),
			),
		);
		await expect(fetchFolderSize('my-bucket', 'docs/')).rejects.toThrow(
			'Failed to calculate folder size: 500',
		);
	});
});
