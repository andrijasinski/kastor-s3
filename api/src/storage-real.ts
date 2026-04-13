import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';
import type { Bucket } from '@shared/types';
import type { Storage } from './storage';

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
}
