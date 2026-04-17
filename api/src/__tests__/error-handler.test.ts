import {describe, it, expect} from 'bun:test';
import {Hono} from 'hono';
import {withErrorHandler} from '../error-handler';

describe('withErrorHandler', () => {
	it('returns handler result when no error', async () => {
		const app = new Hono();
		app.get(
			'/ok',
			withErrorHandler(async (c) => c.json({ok: true})),
		);
		const res = await app.request('/ok');
		expect(res.status).toBe(200);
		const body = (await res.json()) as {ok: boolean};
		expect(body.ok).toBe(true);
	});

	it('returns 500 with real error message on thrown Error', async () => {
		const app = new Hono();
		app.get(
			'/fail',
			withErrorHandler(async () => {
				throw new Error('storage exploded');
			}),
		);
		const res = await app.request('/fail');
		expect(res.status).toBe(500);
		const body = (await res.json()) as {error: string};
		expect(body.error).toBe('storage exploded');
	});

	it('returns 500 with "unknown error" for non-Error throws', async () => {
		const app = new Hono();
		app.get(
			'/fail-string',
			withErrorHandler(async () => {
				// eslint-disable-next-line @typescript-eslint/only-throw-error
				throw 'oops';
			}),
		);
		const res = await app.request('/fail-string');
		expect(res.status).toBe(500);
		const body = (await res.json()) as {error: string};
		expect(body.error).toBe('unknown error');
	});

	it('passes through 400 responses without catching', async () => {
		const app = new Hono();
		app.get(
			'/bad',
			withErrorHandler(async (c) => c.json({error: 'bad input'}, 400)),
		);
		const res = await app.request('/bad');
		expect(res.status).toBe(400);
		const body = (await res.json()) as {error: string};
		expect(body.error).toBe('bad input');
	});

	it('passes through 200 responses with correct body', async () => {
		const app = new Hono();
		app.get(
			'/data',
			withErrorHandler(async (c) => c.json({value: 42})),
		);
		const res = await app.request('/data');
		expect(res.status).toBe(200);
		const body = (await res.json()) as {value: number};
		expect(body.value).toBe(42);
	});
});
