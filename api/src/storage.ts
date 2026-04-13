import type { Bucket, S3Object } from '@shared/types';

export interface Storage {
  listBuckets(): Promise<Bucket[]>;
  listObjects(bucket: string, prefix: string): Promise<S3Object[]>;
}
