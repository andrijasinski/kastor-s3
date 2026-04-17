import type {Context} from 'hono';

export const withErrorHandler = (
	handler: (c: Context) => Promise<Response>,
): ((c: Context) => Promise<Response>) => {
	return async (c: Context) => {
		try {
			return await handler(c);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'unknown error';
			process.stderr.write(`${c.req.method} ${c.req.path} error: ${message}\n`);
			return c.json({error: message}, 500);
		}
	};
};
