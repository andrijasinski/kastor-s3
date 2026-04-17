import {
	S3Client,
	ListBucketsCommand,
	ListObjectsV2Command,
	GetObjectCommand,
	PutObjectCommand,
	DeleteObjectCommand,
	DeleteObjectsCommand,
} from '@aws-sdk/client-s3';

import type {Bucket, S3Object} from '@shared/types';
import type {ListObjectsResult, ObjectStream, Storage} from './storage';
import {getCount, setCount} from './count-cache';

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
		}));
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
		for (let i = 0; i < keys.length; i += chunkSize) {
			const chunk = keys.slice(i, i + chunkSize);
			await this.client.send(
				new DeleteObjectsCommand({
					Bucket: bucket,
					Delete: {Objects: chunk.map((key) => ({Key: key})), Quiet: true},
				}),
			);
		}
	}

	public async putObject(
		bucket: string,
		key: string,
		body: Uint8Array,
		contentType?: string,
	): Promise<void> {
		await this.client.send(
			new PutObjectCommand({
				Bucket: bucket,
				Key: key,
				Body: body,
				...(contentType !== undefined && {ContentType: contentType}),
			}),
		);
	}
}
