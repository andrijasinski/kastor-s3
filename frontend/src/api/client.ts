import type { Bucket } from '@shared/types';

export async function fetchBuckets(): Promise<Bucket[]> {
  const res = await fetch('/api/buckets');
  if (!res.ok) {
    throw new Error(`Failed to fetch buckets: ${res.status}`);
  }
  const data = (await res.json()) as { buckets: Bucket[] };
  return data.buckets;
}
