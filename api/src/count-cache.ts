const TTL_MS = 10 * 60 * 1000;

interface CacheEntry {
	count: number;
	timestamp: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(bucket: string, prefix: string): string {
	return `${bucket}\x00${prefix}`;
}

export function getCount(bucket: string, prefix: string): number | undefined {
	const entry = cache.get(cacheKey(bucket, prefix));
	if (entry === undefined) {
		return undefined;
	}
	if (Date.now() - entry.timestamp > TTL_MS) {
		cache.delete(cacheKey(bucket, prefix));
		return undefined;
	}
	return entry.count;
}

export function setCount(bucket: string, prefix: string, count: number): void {
	cache.set(cacheKey(bucket, prefix), {count, timestamp: Date.now()});
}

export function invalidate(bucket: string, prefix: string): void {
	cache.delete(cacheKey(bucket, prefix));
}

export function invalidateWithAncestors(bucket: string, prefix: string): void {
	invalidate(bucket, prefix);
	const parts = prefix.split('/').filter(Boolean);
	for (let i = 0; i < parts.length; i++) {
		const ancestor = i === 0 ? '' : `${parts.slice(0, i).join('/')}/`;
		invalidate(bucket, ancestor);
	}
}

export function clearAll(): void {
	cache.clear();
}
