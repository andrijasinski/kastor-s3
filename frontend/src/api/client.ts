import type { Bucket, S3Object } from '@shared/types';

export async function fetchBuckets(): Promise<Bucket[]> {
	const res = await fetch('/api/buckets');
	if (!res.ok) {
		throw new Error(`Failed to fetch buckets: ${res.status}`);
	}
	const data = (await res.json()) as { buckets: Bucket[] };
	return data.buckets;
}

export async function fetchObjects(bucket: string, prefix: string): Promise<S3Object[]> {
	const params = new URLSearchParams({ prefix });
	const res = await fetch(
		`/api/buckets/${encodeURIComponent(bucket)}/objects?${params.toString()}`,
	);
	if (!res.ok) {
		throw new Error(`Failed to fetch objects: ${res.status}`);
	}
	const data = (await res.json()) as { objects: S3Object[] };
	return data.objects;
}
