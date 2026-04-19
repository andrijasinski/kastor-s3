import type {Bucket, S3Object} from '@shared/types';

export interface ObjectStream {
	body: ReadableStream<Uint8Array>;
	contentType?: string;
	contentLength?: number;
}

export interface ListObjectsResult {
	objects: S3Object[];
	totalCount: number;
}

export interface Storage {
	listBuckets(): Promise<Bucket[]>;
	listObjects(
		bucket: string,
		prefix: string,
		offset: number,
		limit: number,
	): Promise<ListObjectsResult>;
	listAllObjects(bucket: string, prefix: string): Promise<string[]>;
	getFolderSize(bucket: string, prefix: string): Promise<number>;
	getObjectStream(bucket: string, key: string): Promise<ObjectStream>;
	putObject(
		bucket: string,
		key: string,
		body: ReadableStream<Uint8Array>,
		contentType?: string,
	): Promise<void>;
	deleteObject(bucket: string, key: string): Promise<void>;
	deleteObjects(bucket: string, keys: string[]): Promise<void>;
}
