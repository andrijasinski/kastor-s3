import type { Bucket } from '@shared/types';

export interface Storage {
  listBuckets(): Promise<Bucket[]>;
}
