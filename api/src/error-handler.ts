export const withErrorHandler = (
	handler: (c: any) => Promise<Response>,
): ((c: any) => Promise<Response>) => {
	return async (c: any) => {
		try {
			return await handler(c);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'unknown error';
			process.stderr.write(`${c.req.method} ${c.req.path} error: ${message}\n`);
			return c.json({error: message}, 500);
		}
	};
};
