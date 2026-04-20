import {
	S3Client,
	ListBucketsCommand,
	ListObjectsV2Command,
	GetObjectCommand,
	DeleteObjectCommand,
	DeleteObjectsCommand,
	CreateMultipartUploadCommand,
	UploadPartCommand,
	CompleteMultipartUploadCommand,
	AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import {Upload} from '@aws-sdk/lib-storage';

import type {Bucket, BucketStats, S3Object} from '@shared/types';
import type {ListObjectsResult, ObjectStream, Storage} from './storage';
import {getCount, setCount} from './count-cache';
import {PartialDeleteError, type DeleteFailure} from './errors';

export class S3Storage implements Storage {
	private readonly client: S3Client;

	public constructor(client: S3Client) {
		this.client = client;
	}

	public async listBuckets(): Promise<Bucket[]> {
		const result = await this.client.send(new ListBucketsCommand({}));
		return (result.Buckets ?? []).map((b) => ({
			name: b.Name ?? '',
			creationDate: b.CreationDate?.toISOString() ?? '',
			region: b.BucketRegion ?? '',
		}));
	}

	public async getBucketStats(name: string): Promise<BucketStats> {
		let objectCount = 0;
		let totalSize = 0;
		let continuationToken: string | undefined;
		do {
			const result = await this.client.send(
				new ListObjectsV2Command({
					Bucket: name,
					...(continuationToken !== undefined && {ContinuationToken: continuationToken}),
				}),
			);
			for (const obj of result.Contents ?? []) {
				objectCount++;
				totalSize += obj.Size ?? 0;
			}
			continuationToken = result.NextContinuationToken;
		} while (continuationToken !== undefined);
		return {objectCount, totalSize};
	}

	public async listObjects(
		bucket: string,
		prefix: string,
		offset: number,
		limit: number,
	): Promise<ListObjectsResult> {
		const cachedCount = getCount(bucket, prefix);

		const prefixItems: S3Object[] = [];
		const contentItems: S3Object[] = [];
		let continuationToken: string | undefined;

		do {
			const result = await this.client.send(
				new ListObjectsV2Command({
					Bucket: bucket,
					Prefix: prefix || undefined,
					Delimiter: '/',
					...(continuationToken !== undefined && {ContinuationToken: continuationToken}),
				}),
			);

			for (const p of result.CommonPrefixes ?? []) {
				prefixItems.push({key: p.Prefix ?? '', size: 0, lastModified: '', isPrefix: true});
			}

			for (const obj of result.Contents ?? []) {
				if (obj.Key !== prefix) {
					contentItems.push({
						key: obj.Key ?? '',
						size: obj.Size ?? 0,
						lastModified: obj.LastModified?.toISOString() ?? '',
						isPrefix: false,
					});
				}
			}

			continuationToken = result.NextContinuationToken;

			if (
				cachedCount !== undefined &&
				prefixItems.length + contentItems.length >= offset + limit
			) {
				break;
			}
		} while (continuationToken !== undefined);

		const all = [...prefixItems, ...contentItems];
		const totalCount = cachedCount ?? all.length;

		if (cachedCount === undefined) {
			setCount(bucket, prefix, all.length);
		}

		return {
			objects: all.slice(offset, offset + limit),
			totalCount,
		};
	}

	public async listAllObjects(bucket: string, prefix: string): Promise<string[]> {
		const keys: string[] = [];
		let continuationToken: string | undefined;
		do {
			const result = await this.client.send(
				new ListObjectsV2Command({
					Bucket: bucket,
					Prefix: prefix || undefined,
					...(continuationToken !== undefined && {
						ContinuationToken: continuationToken,
					}),
				}),
			);
			for (const obj of result.Contents ?? []) {
				if (obj.Key !== undefined && !obj.Key.endsWith('/')) {
					keys.push(obj.Key);
				}
			}
			continuationToken = result.NextContinuationToken;
		} while (continuationToken !== undefined);
		return keys;
	}

	public async getFolderSize(bucket: string, prefix: string): Promise<number> {
		let totalSize = 0;
		let continuationToken: string | undefined;
		do {
			const result = await this.client.send(
				new ListObjectsV2Command({
					Bucket: bucket,
					Prefix: prefix || undefined,
					...(continuationToken !== undefined && {
						ContinuationToken: continuationToken,
					}),
				}),
			);
			for (const obj of result.Contents ?? []) {
				totalSize += obj.Size ?? 0;
			}
			continuationToken = result.NextContinuationToken;
		} while (continuationToken !== undefined);
		return totalSize;
	}

	public async getObjectStream(bucket: string, key: string): Promise<ObjectStream> {
		const result = await this.client.send(new GetObjectCommand({Bucket: bucket, Key: key}));
		if (result.Body === undefined) {
			throw new Error('Empty response body from S3');
		}
		return {
			body: result.Body.transformToWebStream(),
			...(result.ContentType !== undefined && {contentType: result.ContentType}),
			...(result.ContentLength !== undefined && {contentLength: result.ContentLength}),
		};
	}

	public async deleteObject(bucket: string, key: string): Promise<void> {
		await this.client.send(new DeleteObjectCommand({Bucket: bucket, Key: key}));
	}

	public async deleteObjects(bucket: string, keys: string[]): Promise<void> {
		const chunkSize = 1000;
		const failures: DeleteFailure[] = [];
		for (let i = 0; i < keys.length; i += chunkSize) {
			const chunk = keys.slice(i, i + chunkSize);
			const result = await this.client.send(
				new DeleteObjectsCommand({
					Bucket: bucket,
					Delete: {Objects: chunk.map((key) => ({Key: key})), Quiet: true},
				}),
			);
			for (const err of result.Errors ?? []) {
				failures.push({
					key: err.Key ?? '',
					code: err.Code ?? 'Unknown',
					message: err.Message ?? 'Unknown error',
				});
			}
		}
		if (failures.length > 0) {
			throw new PartialDeleteError(failures);
		}
	}

	public async putObject(
		bucket: string,
		key: string,
		body: ReadableStream<Uint8Array>,
		contentType?: string,
	): Promise<void> {
		const upload = new Upload({
			client: this.client,
			params: {
				Bucket: bucket,
				Key: key,
				Body: body,
				...(contentType !== undefined && {ContentType: contentType}),
			},
		});
		await upload.done();
	}

	public async createMultipartUpload(
		bucket: string,
		key: string,
		contentType?: string,
	): Promise<string> {
		const result = await this.client.send(
			new CreateMultipartUploadCommand({
				Bucket: bucket,
				Key: key,
				...(contentType !== undefined && {ContentType: contentType}),
			}),
		);
		if (result.UploadId === undefined) {
			throw new Error('No UploadId returned from S3');
		}
		return result.UploadId;
	}

	public async uploadPart(
		bucket: string,
		key: string,
		uploadId: string,
		partNumber: number,
		body: ReadableStream<Uint8Array>,
	): Promise<string> {
		const chunks: Uint8Array[] = [];
		const reader = body.getReader();
		while (true) {
			const {done, value} = await reader.read();
			if (done) {
				break;
			}
			if (value !== undefined) {
				chunks.push(value);
			}
		}
		const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
		const buffer = new Uint8Array(totalLength);
		let offset = 0;
		for (const chunk of chunks) {
			buffer.set(chunk, offset);
			offset += chunk.length;
		}
		const result = await this.client.send(
			new UploadPartCommand({
				Bucket: bucket,
				Key: key,
				UploadId: uploadId,
				PartNumber: partNumber,
				Body: buffer,
				ContentLength: buffer.length,
			}),
		);
		if (result.ETag === undefined) {
			throw new Error('No ETag returned from S3');
		}
		return result.ETag;
	}

	public async completeMultipartUpload(
		bucket: string,
		key: string,
		uploadId: string,
		parts: Array<{partNumber: number; etag: string}>,
	): Promise<void> {
		await this.client.send(
			new CompleteMultipartUploadCommand({
				Bucket: bucket,
				Key: key,
				UploadId: uploadId,
				MultipartUpload: {
					Parts: parts.map((p) => ({PartNumber: p.partNumber, ETag: p.etag})),
				},
			}),
		);
	}

	public async abortMultipartUpload(
		bucket: string,
		key: string,
		uploadId: string,
	): Promise<void> {
		await this.client.send(
			new AbortMultipartUploadCommand({Bucket: bucket, Key: key, UploadId: uploadId}),
		);
	}
}
