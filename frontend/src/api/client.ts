import type {Bucket, BucketStats, S3Object} from '@shared/types';

export interface FetchObjectsResult {
	objects: S3Object[];
	totalCount: number;
}

export async function fetchBuckets(): Promise<Bucket[]> {
	const res = await fetch('/api/buckets');
	if (!res.ok) {
		throw new Error(`Failed to fetch buckets: ${res.status}`);
	}
	const data = (await res.json()) as {buckets: Bucket[]};
	return data.buckets;
}

export async function fetchObjects(
	bucket: string,
	prefix: string,
	offset = 0,
	limit = 100,
): Promise<FetchObjectsResult> {
	const params = new URLSearchParams({
		prefix,
		offset: offset.toString(),
		limit: limit.toString(),
	});
	const res = await fetch(
		`/api/buckets/${encodeURIComponent(bucket)}/objects?${params.toString()}`,
	);
	if (!res.ok) {
		throw new Error(`Failed to fetch objects: ${res.status}`);
	}
	const data = (await res.json()) as {objects: S3Object[]; totalCount: number};
	return {objects: data.objects, totalCount: data.totalCount};
}

export async function fetchBucketStats(bucket: string): Promise<BucketStats> {
	const res = await fetch(`/api/buckets/${encodeURIComponent(bucket)}/stats`);
	if (!res.ok) {
		throw new Error(`Failed to fetch stats for ${bucket}: ${res.status}`);
	}
	return (await res.json()) as BucketStats;
}

export async function createMultipartUpload(
	bucket: string,
	key: string,
	contentType?: string,
): Promise<string> {
	const params = new URLSearchParams({key});
	if (contentType !== undefined && contentType !== '') {
		params.set('contentType', contentType);
	}
	const res = await fetch(
		`/api/buckets/${encodeURIComponent(bucket)}/multipart/create?${params.toString()}`,
		{method: 'POST'},
	);
	if (!res.ok) {
		throw new Error(`Failed to create multipart upload: ${res.status}`);
	}
	const data = (await res.json()) as {uploadId: string};
	return data.uploadId;
}

export async function uploadPart(
	bucket: string,
	key: string,
	uploadId: string,
	partNumber: number,
	chunk: Blob,
	onProgress?: (loaded: number) => void,
): Promise<string> {
	const params = new URLSearchParams({
		key,
		uploadId,
		partNumber: partNumber.toString(),
	});
	return new Promise<string>((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open(
			'PUT',
			`/api/buckets/${encodeURIComponent(bucket)}/multipart/part?${params.toString()}`,
		);
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable && onProgress !== undefined) {
				onProgress(e.loaded);
			}
		};
		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				const data = JSON.parse(xhr.responseText) as {etag: string};
				resolve(data.etag);
			} else {
				reject(new Error(`Part upload failed: ${xhr.status}`));
			}
		};
		xhr.onerror = () => {
			reject(new Error('Network error'));
		};
		xhr.send(chunk);
	});
}

export async function completeMultipartUpload(
	bucket: string,
	key: string,
	uploadId: string,
	parts: Array<{partNumber: number; etag: string}>,
): Promise<void> {
	const params = new URLSearchParams({key, uploadId});
	const headers = new Headers();
	headers.set('Content-Type', 'application/json');
	const res = await fetch(
		`/api/buckets/${encodeURIComponent(bucket)}/multipart/complete?${params.toString()}`,
		{method: 'POST', headers, body: JSON.stringify({parts})},
	);
	if (!res.ok) {
		throw new Error(`Failed to complete multipart upload: ${res.status}`);
	}
}

export async function abortMultipartUpload(
	bucket: string,
	key: string,
	uploadId: string,
): Promise<void> {
	const params = new URLSearchParams({key, uploadId});
	await fetch(`/api/buckets/${encodeURIComponent(bucket)}/multipart?${params.toString()}`, {
		method: 'DELETE',
	});
}

export async function fetchFolderSize(bucket: string, prefix: string): Promise<number> {
	const params = new URLSearchParams({prefix});
	const res = await fetch(
		`/api/buckets/${encodeURIComponent(bucket)}/folder-size?${params.toString()}`,
	);
	const data = (await res.json()) as {size?: number; error?: string};
	if (!res.ok) {
		throw new Error(data.error ?? `Failed to calculate folder size: ${res.status}`);
	}
	return data.size!;
}
