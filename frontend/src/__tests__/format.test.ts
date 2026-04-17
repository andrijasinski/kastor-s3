import {describe, it, expect} from 'vitest';
import {formatSize, formatDate} from '../utils/format';

describe('formatSize', () => {
	it('formats bytes', () => {
		expect(formatSize(500)).toBe('500 B');
	});

	it('formats KB', () => {
		expect(formatSize(1536)).toBe('1.5 KB');
	});

	it('formats MB', () => {
		expect(formatSize(1024 * 1024 * 2)).toBe('2.0 MB');
	});

	it('formats GB', () => {
		expect(formatSize(1024 * 1024 * 1024 * 3)).toBe('3.0 GB');
	});

	it('formats 0 bytes', () => {
		expect(formatSize(0)).toBe('0 B');
	});
});

describe('formatDate', () => {
	it('returns dash for empty string', () => {
		expect(formatDate('')).toBe('—');
	});

	it('formats ISO date string', () => {
		const result = formatDate('2024-01-01T00:00:00.000Z');
		expect(result).not.toBe('—');
		expect(result).toMatch(/2024/);
	});
});
