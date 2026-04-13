import { S3Client, ListBucketsCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import type { Bucket, S3Object } from '@shared/types';
import type { ObjectStream, Storage } from './storage';

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

  public async listObjects(bucket: string, prefix: string): Promise<S3Object[]> {
    const result = await this.client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix || undefined,
        Delimiter: '/',
      }),
    );

    const prefixes: S3Object[] = (result.CommonPrefixes ?? []).map((p) => ({
      key: p.Prefix ?? '',
      size: 0,
      lastModified: '',
      isPrefix: true,
    }));

    const objects = (result.Contents ?? []).reduce<S3Object[]>((acc, obj) => {
      if (obj.Key !== prefix) {
        acc.push({
          key: obj.Key ?? '',
          size: obj.Size ?? 0,
          lastModified: obj.LastModified?.toISOString() ?? '',
          isPrefix: false,
        });
      }
      return acc;
    }, []);

    return [...prefixes, ...objects];
  }

  public async getObjectStream(bucket: string, key: string): Promise<ObjectStream> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (result.Body === undefined) {
      throw new Error('Empty response body from S3');
    }
    return {
      body: result.Body.transformToWebStream(),
      ...(result.ContentType !== undefined && { contentType: result.ContentType }),
      ...(result.ContentLength !== undefined && { contentLength: result.ContentLength }),
    };
  }
}
