import type { Bucket, S3Object } from '@shared/types';

export interface ObjectStream {
	body: ReadableStream<Uint8Array>;
	contentType?: string;
	contentLength?: number;
}

export interface Storage {
	listBuckets(): Promise<Bucket[]>;
	listObjects(bucket: string, prefix: string): Promise<S3Object[]>;
	listAllObjects(bucket: string, prefix: string): Promise<string[]>;
	getObjectStream(bucket: string, key: string): Promise<ObjectStream>;
	putObject(bucket: string, key: string, body: Uint8Array, contentType?: string): Promise<void>;
}
