import type {Bucket, BucketStats, S3Object} from '@shared/types';
import type {ListObjectsResult, ObjectStream, Storage} from './storage';
import {PartialDeleteError} from './errors';

interface FakeStorageOptions {
	fail?: boolean;
	failKeys?: Set<string>;
}

export class FakeStorage implements Storage {
	private readonly buckets: Bucket[];
	private readonly options: FakeStorageOptions;
	private readonly objectsByBucket: Record<string, S3Object[]>;
	private readonly uploadedKeys: Map<string, string[]> = new Map();
	private readonly deletedKeys: Map<string, string[]> = new Map();
	private readonly pendingMultiparts: Map<string, {bucket: string; key: string}> = new Map();
	private nextUploadId = 1;

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
		const failures = keys
			.filter((k) => this.options.failKeys?.has(k))
			.map((k) => ({key: k, code: 'AccessDenied', message: 'Access Denied'}));
		const succeeded = keys.filter((k) => !this.options.failKeys?.has(k));
		const existing = this.deletedKeys.get(bucket) ?? [];
		this.deletedKeys.set(bucket, [...existing, ...succeeded]);
		if (failures.length > 0) {
			throw new PartialDeleteError(failures);
		}
	}

	public async createMultipartUpload(
		bucket: string,
		key: string,
		_contentType?: string,
	): Promise<string> {
		if (this.options.fail === true) {
			throw new Error('FakeStorage: forced failure');
		}
		const uploadId = `fake-upload-${this.nextUploadId++}`;
		this.pendingMultiparts.set(uploadId, {bucket, key});
		return uploadId;
	}

	public async uploadPart(
		_bucket: string,
		_key: string,
		uploadId: string,
		partNumber: number,
		body: ReadableStream<Uint8Array>,
	): Promise<string> {
		if (this.options.fail === true) {
			throw new Error('FakeStorage: forced failure');
		}
		const reader = body.getReader();
		while (!(await reader.read()).done) {
			// drain
		}
		return `"fake-etag-${uploadId}-${partNumber}"`;
	}

	public async completeMultipartUpload(
		bucket: string,
		key: string,
		uploadId: string,
		_parts: Array<{partNumber: number; etag: string}>,
	): Promise<void> {
		if (this.options.fail === true) {
			throw new Error('FakeStorage: forced failure');
		}
		this.pendingMultiparts.delete(uploadId);
		const keys = this.uploadedKeys.get(bucket) ?? [];
		keys.push(key);
		this.uploadedKeys.set(bucket, keys);
	}

	public async abortMultipartUpload(
		_bucket: string,
		_key: string,
		uploadId: string,
	): Promise<void> {
		if (this.options.fail === true) {
			throw new Error('FakeStorage: forced failure');
		}
		this.pendingMultiparts.delete(uploadId);
	}

	public async getBucketStats(name: string): Promise<BucketStats> {
		if (this.options.fail === true) {
			throw new Error('FakeStorage: forced failure');
		}
		const objects = (this.objectsByBucket[name] ?? []).filter((obj) => !obj.isPrefix);
		return {
			objectCount: objects.length,
			totalSize: objects.reduce((sum, obj) => sum + obj.size, 0),
		};
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
