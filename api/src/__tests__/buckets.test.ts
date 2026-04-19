import {describe, it, expect} from 'bun:test';
import {createApp} from '../app';
import {FakeStorage} from '../storage-fake';
import type {Bucket, BucketStats} from '@shared/types';

const fakeBuckets: Bucket[] = [
	{name: 'my-bucket', creationDate: '2024-01-01T00:00:00.000Z', region: 'us-east-1'},
	{name: 'another-bucket', creationDate: '2024-02-01T00:00:00.000Z', region: 'eu-west-1'},
];

describe('GET /api/buckets', () => {
	it('returns 200 with bucket list including region', async () => {
		const app = createApp(new FakeStorage(fakeBuckets));
		const res = await app.request('/api/buckets');

		expect(res.status).toBe(200);
		const body = (await res.json()) as {buckets: Bucket[]};
		expect(body.buckets).toEqual(fakeBuckets);
		expect(body.buckets.find((b) => b.name === 'my-bucket')?.region).toBe('us-east-1');
		expect(body.buckets.find((b) => b.name === 'another-bucket')?.region).toBe('eu-west-1');
	});

	it('returns 500 when storage fails', async () => {
		const app = createApp(new FakeStorage([], {fail: true}));
		const res = await app.request('/api/buckets');

		expect(res.status).toBe(500);
	});
});

describe('GET /api/buckets/:bucket/stats', () => {
	it('returns correct objectCount and totalSize', async () => {
		const bucketName = 'my-bucket';
		const storage = new FakeStorage(
			fakeBuckets,
			{},
			{
				[bucketName]: [
					{key: 'file1.txt', size: 100, lastModified: '', isPrefix: false},
					{key: 'file2.txt', size: 200, lastModified: '', isPrefix: false},
				],
			},
		);
		const app = createApp(storage);
		const res = await app.request('/api/buckets/my-bucket/stats');

		expect(res.status).toBe(200);
		const body = (await res.json()) as BucketStats;
		expect(body.objectCount).toBe(2);
		expect(body.totalSize).toBe(300);
	});

	it('returns zeros for empty bucket', async () => {
		const app = createApp(new FakeStorage(fakeBuckets));
		const res = await app.request('/api/buckets/my-bucket/stats');

		expect(res.status).toBe(200);
		const body = (await res.json()) as BucketStats;
		expect(body.objectCount).toBe(0);
		expect(body.totalSize).toBe(0);
	});

	it('excludes prefix entries from stats', async () => {
		const bucketName = 'my-bucket';
		const storage = new FakeStorage(
			fakeBuckets,
			{},
			{
				[bucketName]: [
					{key: 'folder/', size: 0, lastModified: '', isPrefix: true},
					{key: 'folder/file.txt', size: 500, lastModified: '', isPrefix: false},
				],
			},
		);
		const app = createApp(storage);
		const res = await app.request('/api/buckets/my-bucket/stats');

		expect(res.status).toBe(200);
		const body = (await res.json()) as BucketStats;
		expect(body.objectCount).toBe(1);
		expect(body.totalSize).toBe(500);
	});

	it('returns 500 when storage fails', async () => {
		const app = createApp(new FakeStorage(fakeBuckets, {fail: true}));
		const res = await app.request('/api/buckets/my-bucket/stats');

		expect(res.status).toBe(500);
	});
});
