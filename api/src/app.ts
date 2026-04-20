import {Hono} from 'hono';
import {Zip, ZipPassThrough} from 'fflate';
import type {Storage} from './storage';
import {invalidate, invalidateWithAncestors} from './count-cache';
import {withErrorHandler} from './error-handler';
import {PartialDeleteError} from './errors';

function buildZipStream(
	storage: Storage,
	bucket: string,
	keys: string[],
	prefix: string,
): ReadableStream<Uint8Array> {
	return new ReadableStream<Uint8Array>({
		async start(controller) {
			const zip = new Zip((err, chunk, final) => {
				if (err !== null) {
					controller.error(err);
					return;
				}
				controller.enqueue(chunk);
				if (final) {
					controller.close();
				}
			});

			try {
				for (const key of keys) {
					const entryName = key.slice(prefix.length);
					const entry = new ZipPassThrough(entryName);
					zip.add(entry);
					const {body} = await storage.getObjectStream(bucket, key);
					const reader = body.getReader();
					while (true) {
						const {done, value} = await reader.read();
						if (done) {
							entry.push(new Uint8Array(0), true);
							break;
						}
						entry.push(value, false);
					}
				}
				zip.end();
			} catch (err) {
				controller.error(err instanceof Error ? err : new Error(String(err)));
			}
		},
	});
}

export function createApp(storage: Storage): Hono {
	const app = new Hono();

	app.get(
		'/api/buckets',
		withErrorHandler(async (c) => {
			const buckets = await storage.listBuckets();
			return c.json({buckets});
		}),
	);

	app.get(
		'/api/buckets/:bucket/stats',
		withErrorHandler(async (c) => {
			const {bucket} = c.req.param();
			const stats = await storage.getBucketStats(bucket);
			return c.json(stats);
		}),
	);

	app.get(
		'/api/buckets/:bucket/objects',
		withErrorHandler(async (c) => {
			const {bucket} = c.req.param();
			const prefix = c.req.query('prefix') ?? '';
			const offset = parseInt(c.req.query('offset') ?? '0', 10);
			const limit = parseInt(c.req.query('limit') ?? '100', 10);
			const {objects, totalCount} = await storage.listObjects(bucket, prefix, offset, limit);
			return c.json({objects, totalCount});
		}),
	);

	app.get(
		'/api/buckets/:bucket/objects-all',
		withErrorHandler(async (c) => {
			const {bucket} = c.req.param();
			const prefix = c.req.query('prefix') ?? '';
			const keys = await storage.listAllObjects(bucket, prefix);
			return c.json({keys});
		}),
	);

	app.get(
		'/api/buckets/:bucket/folder-size',
		withErrorHandler(async (c) => {
			const {bucket} = c.req.param();
			const prefix = c.req.query('prefix') ?? '';
			const size = await storage.getFolderSize(bucket, prefix);
			return c.json({size});
		}),
	);

	app.get(
		'/api/buckets/:bucket/object',
		withErrorHandler(async (c) => {
			const {bucket} = c.req.param();
			const key = c.req.query('key');
			if (key === undefined || key === '') {
				return c.json({error: 'Missing key parameter'}, 400);
			}
			const {body, contentType, contentLength} = await storage.getObjectStream(bucket, key);
			const headers = new Headers();
			if (contentType !== undefined) {
				headers.set('Content-Type', contentType);
			}
			if (contentLength !== undefined) {
				headers.set('Content-Length', contentLength.toString());
			}
			return new Response(body, {headers});
		}),
	);

	app.get(
		'/api/buckets/:bucket/download',
		withErrorHandler(async (c) => {
			const {bucket} = c.req.param();
			const key = c.req.query('key');
			if (key === undefined || key === '') {
				return c.json({error: 'Missing key parameter'}, 400);
			}
			const filename = key.split('/').pop() ?? key;
			const {body, contentType, contentLength} = await storage.getObjectStream(bucket, key);
			const headers = new Headers();
			headers.set(
				'Content-Disposition',
				`attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
			);
			if (contentType !== undefined) {
				headers.set('Content-Type', contentType);
			}
			if (contentLength !== undefined) {
				headers.set('Content-Length', contentLength.toString());
			}
			return new Response(body, {headers});
		}),
	);

	app.put(
		'/api/buckets/:bucket/upload',
		withErrorHandler(async (c) => {
			const {bucket} = c.req.param();
			const key = c.req.query('key') ?? '';
			if (key === '') {
				return c.json({error: 'Missing key'}, 400);
			}
			const contentType = c.req.query('contentType') || undefined;
			const body =
				c.req.raw.body ??
				new ReadableStream<Uint8Array>({
					start(ctrl) {
						ctrl.close();
					},
				});
			await storage.putObject(bucket, key, body, contentType);
			const lastSlash = key.lastIndexOf('/');
			const prefix = lastSlash >= 0 ? key.slice(0, lastSlash + 1) : '';
			invalidate(bucket, prefix);
			return c.json({ok: true});
		}),
	);

	app.delete(
		'/api/buckets/:bucket/object',
		withErrorHandler(async (c) => {
			const {bucket} = c.req.param();
			const key = c.req.query('key');
			if (key === undefined || key === '') {
				return c.json({error: 'Missing key parameter'}, 400);
			}
			await storage.deleteObject(bucket, key);
			const lastSlash = key.lastIndexOf('/');
			const parentPrefix = lastSlash === -1 ? '' : key.slice(0, lastSlash + 1);
			invalidate(bucket, parentPrefix);
			return c.json({ok: true});
		}),
	);

	app.delete(
		'/api/buckets/:bucket/folder',
		withErrorHandler(async (c) => {
			const {bucket} = c.req.param();
			const prefix = c.req.query('prefix');
			if (prefix === undefined || prefix === '') {
				return c.json({error: 'Missing prefix parameter'}, 400);
			}
			const keys = await storage.listAllObjects(bucket, prefix);
			if (keys.length > 0) {
				try {
					await storage.deleteObjects(bucket, keys);
				} catch (err) {
					if (err instanceof PartialDeleteError) {
						invalidateWithAncestors(bucket, prefix);
						return c.json(
							{error: 'Some objects failed to delete', failedKeys: err.failures},
							207,
						);
					}
					throw err;
				}
			}
			invalidateWithAncestors(bucket, prefix);
			return c.json({ok: true});
		}),
	);

	app.get(
		'/api/buckets/:bucket/download-folder',
		withErrorHandler(async (c) => {
			const {bucket} = c.req.param();
			const prefix = c.req.query('prefix') ?? '';
			const folderName = prefix.split('/').filter(Boolean).pop() ?? bucket;
			const keys = await storage.listAllObjects(bucket, prefix);
			const zipStream = buildZipStream(storage, bucket, keys, prefix);
			const headers = new Headers();
			headers.set('Content-Type', 'application/zip');
			headers.set(
				'Content-Disposition',
				`attachment; filename*=UTF-8''${encodeURIComponent(folderName)}.zip`,
			);
			return new Response(zipStream, {headers});
		}),
	);

	return app;
}
