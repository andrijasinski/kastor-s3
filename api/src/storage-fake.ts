import type {Bucket, S3Object} from '@shared/types';
import type {ListObjectsResult, ObjectStream, Storage} from './storage';

interface FakeStorageOptions {
	fail?: boolean;
}

export class FakeStorage implements Storage {
	private readonly buckets: Bucket[];
	private readonly options: FakeStorageOptions;
	private readonly objectsByBucket: Record<string, S3Object[]>;
	private readonly uploadedKeys: Map<string, string[]> = new Map();
	private readonly deletedKeys: Map<string, string[]> = new Map();

	public constructor(
		buckets: Bucket[],
		options: FakeStorageOptions = {},
		objectsByBucket: Record<string, S3Object[]> = {},
	) {
		this.buckets = buckets;
		this.options = options;
		this.objectsByBucket = objectsByBucket;
	}

	public async listBuckets(): Promise<Bucket[]> {
		if (this.options.fail === true) {
			throw new Error('FakeStorage: forced failure');
		}
		return this.buckets;
	}

	public async listObjects(
		bucket: string,
		_prefix: string,
		offset: number,
		limit: number,
	): Promise<ListObjectsResult> {
		if (this.options.fail === true) {
			throw new Error('FakeStorage: forced failure');
		}
		const all = this.objectsByBucket[bucket] ?? [];
		return {
			objects: all.slice(offset, offset + limit),
			totalCount: all.length,
		};
	}

	public async listAllObjects(bucket: string, prefix: string): Promise<string[]> {
		if (this.options.fail === true) {
			throw new Error('FakeStorage: forced failure');
		}
		return (this.objectsByBucket[bucket] ?? [])
			.filter((obj) => !obj.isPrefix && obj.key.startsWith(prefix))
			.map((obj) => obj.key);
	}

	public async getFolderSize(bucket: string, prefix: string): Promise<number> {
		if (this.options.fail === true) {
			throw new Error('FakeStorage: forced failure');
		}
		return (this.objectsByBucket[bucket] ?? [])
			.filter((obj) => !obj.isPrefix && obj.key.startsWith(prefix))
			.reduce((sum, obj) => sum + obj.size, 0);
	}

	public async putObject(
		bucket: string,
		key: string,
		body: ReadableStream<Uint8Array>,
		_contentType?: string,
	): Promise<void> {
		if (this.options.fail === true) {
			throw new Error('FakeStorage: forced failure');
		}
		const reader = body.getReader();
		while (!(await reader.read()).done) {
			// drain
		}
		const keys = this.uploadedKeys.get(bucket) ?? [];
		keys.push(key);
		this.uploadedKeys.set(bucket, keys);
	}

	public getUploadedKeys(bucket: string): string[] {
		return this.uploadedKeys.get(bucket) ?? [];
	}

	public async deleteObject(bucket: string, key: string): Promise<void> {
		if (this.options.fail === true) {
			throw new Error('FakeStorage: forced failure');
		}
		const keys = this.deletedKeys.get(bucket) ?? [];
		keys.push(key);
		this.deletedKeys.set(bucket, keys);
	}

	public getDeletedKeys(bucket: string): string[] {
		return this.deletedKeys.get(bucket) ?? [];
	}

	public async deleteObjects(bucket: string, keys: string[]): Promise<void> {
		if (this.options.fail === true) {
			throw new Error('FakeStorage: forced failure');
		}
		const existing = this.deletedKeys.get(bucket) ?? [];
		this.deletedKeys.set(bucket, [...existing, ...keys]);
	}

	public async getObjectStream(_bucket: string, _key: string): Promise<ObjectStream> {
		if (this.options.fail === true) {
			throw new Error('FakeStorage: forced failure');
		}
		const content = new TextEncoder().encode('fake file content');
		const body = new ReadableStream({
			start(controller) {
				controller.enqueue(content);
				controller.close();
			},
		});
		return {body, contentType: 'application/octet-stream', contentLength: content.byteLength};
	}
}
