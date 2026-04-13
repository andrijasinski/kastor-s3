import type { Bucket, S3Object } from '@shared/types';
import type { ObjectStream, Storage } from './storage';

interface FakeStorageOptions {
  fail?: boolean;
}

export class FakeStorage implements Storage {
  private readonly buckets: Bucket[];
  private readonly options: FakeStorageOptions;
  private readonly objectsByBucket: Record<string, S3Object[]>;

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

  public async listObjects(bucket: string, _prefix: string): Promise<S3Object[]> {
    if (this.options.fail === true) {
      throw new Error('FakeStorage: forced failure');
    }
    return this.objectsByBucket[bucket] ?? [];
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
    return { body, contentType: 'application/octet-stream', contentLength: content.byteLength };
  }
}
