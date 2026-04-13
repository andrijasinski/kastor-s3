import type { Bucket, S3Object } from '@shared/types';

export interface ObjectStream {
  body: ReadableStream;
  contentType?: string;
  contentLength?: number;
}

export interface Storage {
  listBuckets(): Promise<Bucket[]>;
  listObjects(bucket: string, prefix: string): Promise<S3Object[]>;
  getObjectStream(bucket: string, key: string): Promise<ObjectStream>;
}
