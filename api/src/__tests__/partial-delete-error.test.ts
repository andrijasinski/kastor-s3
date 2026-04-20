import {describe, it, expect} from 'bun:test';
import {PartialDeleteError} from '../errors';

describe('PartialDeleteError', () => {
	it('is an Error subclass', () => {
		const err = new PartialDeleteError([{key: 'a', code: 'AccessDenied', message: 'Denied'}]);
		expect(err).toBeInstanceOf(Error);
		expect(err).toBeInstanceOf(PartialDeleteError);
	});

	it('carries failures array', () => {
		const failures = [
			{key: 'foo/bar.txt', code: 'AccessDenied', message: 'Access Denied'},
			{key: 'foo/baz.txt', code: 'InternalError', message: 'Internal Error'},
		];
		const err = new PartialDeleteError(failures);
		expect(err.failures).toEqual(failures);
	});

	it('message includes failure count', () => {
		const err = new PartialDeleteError([
			{key: 'a', code: 'X', message: 'y'},
			{key: 'b', code: 'X', message: 'y'},
		]);
		expect(err.message).toBe('2 object(s) failed to delete');
	});

	it('name is PartialDeleteError', () => {
		const err = new PartialDeleteError([{key: 'a', code: 'X', message: 'y'}]);
		expect(err.name).toBe('PartialDeleteError');
	});
});
