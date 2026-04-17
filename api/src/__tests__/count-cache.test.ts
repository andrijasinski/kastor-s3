import {describe, it, expect, beforeEach} from 'bun:test';
import {getCount, setCount, invalidate, invalidateWithAncestors, clearAll} from '../count-cache';

beforeEach(() => {
	clearAll();
});

describe('getCount / setCount', () => {
	it('returns undefined on cache miss', () => {
		expect(getCount('bucket', 'prefix/')).toBeUndefined();
	});

	it('returns cached count on hit', () => {
		setCount('bucket', 'prefix/', 42);
		expect(getCount('bucket', 'prefix/')).toBe(42);
	});

	it('isolates entries by bucket', () => {
		setCount('bucket-a', '', 10);
		setCount('bucket-b', '', 20);
		expect(getCount('bucket-a', '')).toBe(10);
		expect(getCount('bucket-b', '')).toBe(20);
	});

	it('isolates entries by prefix', () => {
		setCount('bucket', 'a/', 1);
		setCount('bucket', 'b/', 2);
		expect(getCount('bucket', 'a/')).toBe(1);
		expect(getCount('bucket', 'b/')).toBe(2);
	});

	it('treats bucket name containing null byte correctly', () => {
		setCount('a\x00b', '', 5);
		expect(getCount('a\x00b', '')).toBe(5);
		expect(getCount('a', 'b')).toBeUndefined();
	});
});

describe('invalidate', () => {
	it('removes the specific entry', () => {
		setCount('bucket', 'docs/', 5);
		invalidate('bucket', 'docs/');
		expect(getCount('bucket', 'docs/')).toBeUndefined();
	});

	it('does not remove other entries', () => {
		setCount('bucket', 'docs/', 5);
		setCount('bucket', 'other/', 3);
		invalidate('bucket', 'docs/');
		expect(getCount('bucket', 'other/')).toBe(3);
	});
});

describe('invalidateWithAncestors', () => {
	it('removes the prefix and all ancestor prefixes', () => {
		setCount('bucket', 'a/b/c/', 1);
		setCount('bucket', 'a/b/', 5);
		setCount('bucket', 'a/', 10);
		setCount('bucket', '', 20);

		invalidateWithAncestors('bucket', 'a/b/c/');

		expect(getCount('bucket', 'a/b/c/')).toBeUndefined();
		expect(getCount('bucket', 'a/b/')).toBeUndefined();
		expect(getCount('bucket', 'a/')).toBeUndefined();
		expect(getCount('bucket', '')).toBeUndefined();
	});

	it('does not remove unrelated entries', () => {
		setCount('bucket', 'docs/', 5);
		setCount('bucket', 'images/', 3);
		invalidateWithAncestors('bucket', 'docs/');
		expect(getCount('bucket', 'images/')).toBe(3);
	});

	it('works for top-level prefix', () => {
		setCount('bucket', 'docs/', 5);
		setCount('bucket', '', 10);
		invalidateWithAncestors('bucket', 'docs/');
		expect(getCount('bucket', 'docs/')).toBeUndefined();
		expect(getCount('bucket', '')).toBeUndefined();
	});
});
