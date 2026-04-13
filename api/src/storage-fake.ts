import type { Bucket } from '@shared/types';
import type { Storage } from './storage';

interface FakeStorageOptions {
  fail?: boolean;
}

export class FakeStorage implements Storage {
  private readonly buckets: Bucket[];
  private readonly options: FakeStorageOptions;

  public constructor(buckets: Bucket[], options: FakeStorageOptions = {}) {
    this.buckets = buckets;
    this.options = options;
  }

  public async listBuckets(): Promise<Bucket[]> {
    if (this.options.fail === true) {
      throw new Error('FakeStorage: forced failure');
    }
    return this.buckets;
  }
}
