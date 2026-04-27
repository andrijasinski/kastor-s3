export interface Bucket {
	name: string;
	creationDate: string;
	region: string;
}

export interface BucketStats {
	objectCount: number;
	totalSize: number;
}

export interface S3Object {
	key: string;
	size: number;
	lastModified: string;
	isPrefix: boolean;
	etag?: string;
	contentType?: string;
}
