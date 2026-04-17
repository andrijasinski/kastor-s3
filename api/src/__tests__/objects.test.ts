import {describe, it, expect} from 'bun:test';
import {createApp} from '../app';
import {FakeStorage} from '../storage-fake';
import type {S3Object} from '@shared/types';

const fakeObjects: S3Object[] = [
	{key: 'docs/', size: 0, lastModified: '', isPrefix: true},
	{key: 'readme.txt', size: 1024, lastModified: '2024-01-01T00:00:00.000Z', isPrefix: false},
];

describe('GET /api/buckets/:bucket/folder-size', () => {
	it('returns summed size of all objects under prefix', async () => {
		const objects: S3Object[] = [
			{key: 'docs/a.txt', size: 500, lastModified: '', isPrefix: false},
			{key: 'docs/b.txt', size: 1500, lastModified: '', isPrefix: false},
			{key: 'other.txt', size: 9999, lastModified: '', isPrefix: false},
		];
		const app = createApp(new FakeStorage([], {}, {testBucket: objects}));
		const res = await app.request('/api/buckets/testBucket/folder-size?prefix=docs/');

		expect(res.status).toBe(200);
		const body = (await res.json()) as {size: number};
		expect(body.size).toBe(2000);
	});

	it('returns 0 for unknown bucket', async () => {
		const app = createApp(new FakeStorage([], {}, {}));
		const res = await app.request('/api/buckets/no-such-bucket/folder-size?prefix=docs/');

		expect(res.status).toBe(200);
		const body = (await res.json()) as {size: number};
		expect(body.size).toBe(0);
	});

	it('returns 500 with error message on storage failure', async () => {
		const app = createApp(new FakeStorage([], {fail: true}));
		const res = await app.request('/api/buckets/my-bucket/folder-size?prefix=docs/');

		expect(res.status).toBe(500);
		const body = (await res.json()) as {error: string};
		expect(body.error).toBe('FakeStorage: forced failure');
	});
});

describe('GET /api/buckets/:bucket/objects', () => {
	it('returns 200 with objects list and totalCount', async () => {
		const app = createApp(new FakeStorage([], {}, {testBucket: fakeObjects}));
		const res = await app.request('/api/buckets/testBucket/objects?prefix=');

		expect(res.status).toBe(200);
		const body = (await res.json()) as {objects: S3Object[]; totalCount: number};
		expect(body.objects).toEqual(fakeObjects);
		expect(body.totalCount).toBe(2);
	});

	it('returns empty list for unknown bucket', async () => {
		const app = createApp(new FakeStorage([], {}, {}));
		const res = await app.request('/api/buckets/no-such-bucket/objects');

		expect(res.status).toBe(200);
		const body = (await res.json()) as {objects: S3Object[]; totalCount: number};
		expect(body.objects).toEqual([]);
		expect(body.totalCount).toBe(0);
	});

	it('returns 500 when storage fails', async () => {
		const app = createApp(new FakeStorage([], {fail: true}));
		const res = await app.request('/api/buckets/my-bucket/objects');

		expect(res.status).toBe(500);
	});

	it('applies offset and limit from query params', async () => {
		const objects: S3Object[] = [
			{key: 'a.txt', size: 1, lastModified: '', isPrefix: false},
			{key: 'b.txt', size: 2, lastModified: '', isPrefix: false},
			{key: 'c.txt', size: 3, lastModified: '', isPrefix: false},
			{key: 'd.txt', size: 4, lastModified: '', isPrefix: false},
			{key: 'e.txt', size: 5, lastModified: '', isPrefix: false},
		];
		const app = createApp(new FakeStorage([], {}, {testBucket: objects}));
		const res = await app.request('/api/buckets/testBucket/objects?prefix=&offset=1&limit=2');

		expect(res.status).toBe(200);
		const body = (await res.json()) as {objects: S3Object[]; totalCount: number};
		expect(body.objects).toEqual([objects[1], objects[2]]);
		expect(body.totalCount).toBe(5);
	});

	it('defaults to offset=0 limit=100', async () => {
		const app = createApp(new FakeStorage([], {}, {testBucket: fakeObjects}));
		const res = await app.request('/api/buckets/testBucket/objects?prefix=');

		const body = (await res.json()) as {objects: S3Object[]; totalCount: number};
		expect(body.objects.length).toBe(2);
		expect(body.totalCount).toBe(2);
	});
});

describe('S3Storage.listObjects pagination', () => {
	it('merges multiple S3 pages and returns sliced results', async () => {
		const page1Objects = [
			{Key: 'file1.txt', Size: 100, LastModified: new Date('2024-01-01')},
			{Key: 'file2.txt', Size: 200, LastModified: new Date('2024-01-02')},
		];
		const page2Objects = [{Key: 'file3.txt', Size: 300, LastModified: new Date('2024-01-03')}];

		let callCount = 0;
		const mockClient = {
			send: (_command: unknown) => {
				callCount++;
				if (callCount === 1) {
					return Promise.resolve({
						CommonPrefixes: [{Prefix: 'docs/'}],
						Contents: page1Objects,
						NextContinuationToken: 'token1',
						IsTruncated: true,
					});
				}
				return Promise.resolve({
					CommonPrefixes: [],
					Contents: page2Objects,
					NextContinuationToken: undefined,
					IsTruncated: false,
				});
			},
		};

		const {S3Storage} = await import('../storage-real');
		const {clearAll} = await import('../count-cache');
		clearAll();

		const storage = new S3Storage(mockClient as never);
		const result = await storage.listObjects('bucket', '', 0, 10);

		expect(result.totalCount).toBe(4); // 1 prefix + 3 files
		expect(result.objects).toHaveLength(4);
		expect(result.objects[0]).toMatchObject({key: 'docs/', isPrefix: true});
		expect(result.objects[1]).toMatchObject({key: 'file1.txt', isPrefix: false});
		expect(result.objects[2]).toMatchObject({key: 'file2.txt', isPrefix: false});
		expect(result.objects[3]).toMatchObject({key: 'file3.txt', isPrefix: false});
		expect(callCount).toBe(2);

		clearAll();
	});

	it('filters placeholder object matching prefix', async () => {
		const mockClient = {
			send: (_command: unknown) =>
				Promise.resolve({
					CommonPrefixes: [],
					Contents: [
						{Key: 'docs/', Size: 0, LastModified: new Date()},
						{Key: 'docs/file.txt', Size: 100, LastModified: new Date('2024-01-01')},
					],
					NextContinuationToken: undefined,
					IsTruncated: false,
				}),
		};

		const {S3Storage} = await import('../storage-real');
		const {clearAll} = await import('../count-cache');
		clearAll();

		const storage = new S3Storage(mockClient as never);
		const result = await storage.listObjects('bucket', 'docs/', 0, 10);

		expect(result.objects).toHaveLength(1);
		expect(result.objects[0].key).toBe('docs/file.txt');

		clearAll();
	});

	it('stops early when cache hit and enough items collected', async () => {
		let callCount = 0;
		const mockClient = {
			send: (_command: unknown) => {
				callCount++;
				if (callCount === 1) {
					return Promise.resolve({
						CommonPrefixes: [],
						Contents: Array.from({length: 5}, (_, i) => ({
							Key: `file${i}.txt`,
							Size: i,
							LastModified: new Date(),
						})),
						NextContinuationToken: 'token1',
						IsTruncated: true,
					});
				}
				return Promise.resolve({
					CommonPrefixes: [],
					Contents: Array.from({length: 5}, (_, i) => ({
						Key: `file${i + 5}.txt`,
						Size: i + 5,
						LastModified: new Date(),
					})),
					NextContinuationToken: undefined,
					IsTruncated: false,
				});
			},
		};

		const {S3Storage} = await import('../storage-real');
		const {clearAll, setCount} = await import('../count-cache');
		clearAll();
		setCount('bucket', '', 10);

		const storage = new S3Storage(mockClient as never);
		const result = await storage.listObjects('bucket', '', 0, 5);

		expect(result.totalCount).toBe(10);
		expect(result.objects).toHaveLength(5);
		expect(callCount).toBe(1); // stopped early after first page

		clearAll();
	});
});

describe('Count cache invalidation via routes', () => {
	it('invalidates cache on upload', async () => {
		const {clearAll, setCount, getCount} = await import('../count-cache');
		clearAll();
		setCount('testBucket', 'docs/', 5);

		const app = createApp(new FakeStorage([], {}, {}));
		const formData = new FormData();
		formData.append('file', new File(['content'], 'test.txt'));
		await app.request('/api/buckets/testBucket/upload?prefix=docs/', {
			method: 'POST',
			body: formData,
		});

		expect(getCount('testBucket', 'docs/')).toBeUndefined();
		clearAll();
	});

	it('invalidates cache on single-object delete', async () => {
		const {clearAll, setCount, getCount} = await import('../count-cache');
		clearAll();
		setCount('testBucket', 'docs/', 5);

		const app = createApp(new FakeStorage([], {}, {}));
		await app.request('/api/buckets/testBucket/object?key=docs/file.txt', {method: 'DELETE'});

		expect(getCount('testBucket', 'docs/')).toBeUndefined();
		clearAll();
	});

	it('invalidates cache and ancestors on folder delete', async () => {
		const {clearAll, setCount, getCount} = await import('../count-cache');
		clearAll();
		setCount('testBucket', 'docs/sub/', 3);
		setCount('testBucket', 'docs/', 10);
		setCount('testBucket', '', 20);

		const app = createApp(new FakeStorage([], {}, {}));
		await app.request('/api/buckets/testBucket/folder?prefix=docs/sub/', {method: 'DELETE'});

		expect(getCount('testBucket', 'docs/sub/')).toBeUndefined();
		expect(getCount('testBucket', 'docs/')).toBeUndefined();
		expect(getCount('testBucket', '')).toBeUndefined();
		clearAll();
	});
});
