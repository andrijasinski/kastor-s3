import {describe, it, expect} from 'vitest';
import {buildBreadcrumbSegments} from '../utils/breadcrumbs';

describe('buildBreadcrumbSegments', () => {
	it('returns empty array for empty path', () => {
		expect(buildBreadcrumbSegments('')).toEqual([]);
	});

	it('returns single segment with null prefix for single-part path', () => {
		expect(buildBreadcrumbSegments('file.txt')).toEqual([{label: 'file.txt', prefix: null}]);
	});

	it('last segment has null prefix', () => {
		const segments = buildBreadcrumbSegments('a/b/c');
		expect(segments.at(-1)?.prefix).toBeNull();
	});

	it('intermediate segments have correct prefix', () => {
		const segments = buildBreadcrumbSegments('a/b/c');
		expect(segments[0]).toEqual({label: 'a', prefix: 'a/'});
		expect(segments[1]).toEqual({label: 'b', prefix: 'a/b/'});
		expect(segments[2]).toEqual({label: 'c', prefix: null});
	});

	it('filters trailing slash (folder prefix)', () => {
		const segments = buildBreadcrumbSegments('docs/');
		expect(segments).toEqual([{label: 'docs', prefix: null}]);
	});

	it('handles two-part path', () => {
		const segments = buildBreadcrumbSegments('photos/beach.jpg');
		expect(segments).toEqual([
			{label: 'photos', prefix: 'photos/'},
			{label: 'beach.jpg', prefix: null},
		]);
	});
});
