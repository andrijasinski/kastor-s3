export interface Bucket {
	name: string;
	creationDate: string;
}

export interface S3Object {
	key: string;
	size: number;
	lastModified: string;
	isPrefix: boolean;
}
