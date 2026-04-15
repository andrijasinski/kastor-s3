import {Hono} from 'hono';
import {Zip, ZipPassThrough} from 'fflate';
import type {Storage} from './storage';

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

	app.get('/api/buckets', async (c) => {
		try {
			const buckets = await storage.listBuckets();
			return c.json({buckets});
		} catch (err) {
			process.stderr.write(
				`GET /api/buckets error: ${err instanceof Error ? err.message : 'unknown error'}\n`,
			);
			return c.json({error: 'Failed to list buckets'}, 500);
		}
	});

	app.get('/api/buckets/:bucket/objects', async (c) => {
		const {bucket} = c.req.param();
		const prefix = c.req.query('prefix') ?? '';
		try {
			const objects = await storage.listObjects(bucket, prefix);
			return c.json({objects});
		} catch (err) {
			process.stderr.write(
				`GET /api/buckets/${bucket}/objects error: ${err instanceof Error ? err.message : 'unknown error'}\n`,
			);
			return c.json({error: 'Failed to list objects'}, 500);
		}
	});

	app.get('/api/buckets/:bucket/objects-all', async (c) => {
		const {bucket} = c.req.param();
		const prefix = c.req.query('prefix') ?? '';
		try {
			const keys = await storage.listAllObjects(bucket, prefix);
			return c.json({keys});
		} catch (err) {
			process.stderr.write(
				`GET /api/buckets/${bucket}/objects-all error: ${err instanceof Error ? err.message : 'unknown error'}\n`,
			);
			return c.json({error: 'Failed to list objects'}, 500);
		}
	});

	app.get('/api/buckets/:bucket/folder-size', async (c) => {
		const {bucket} = c.req.param();
		const prefix = c.req.query('prefix') ?? '';
		try {
			const size = await storage.getFolderSize(bucket, prefix);
			return c.json({size});
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Unknown error';
			process.stderr.write(`GET /api/buckets/${bucket}/folder-size error: ${message}\n`);
			return c.json({error: message}, 500);
		}
	});

	app.get('/api/buckets/:bucket/object', async (c) => {
		const {bucket} = c.req.param();
		const key = c.req.query('key');
		if (key === undefined || key === '') {
			return c.json({error: 'Missing key parameter'}, 400);
		}
		try {
			const {body, contentType, contentLength} = await storage.getObjectStream(bucket, key);
			const headers = new Headers();
			if (contentType !== undefined) {
				headers.set('Content-Type', contentType);
			}
			if (contentLength !== undefined) {
				headers.set('Content-Length', contentLength.toString());
			}
			return new Response(body, {headers});
		} catch (err) {
			process.stderr.write(
				`GET /api/buckets/${bucket}/object error: ${err instanceof Error ? err.message : 'unknown error'}\n`,
			);
			return c.json({error: 'Failed to stream object'}, 500);
		}
	});

	app.get('/api/buckets/:bucket/download', async (c) => {
		const {bucket} = c.req.param();
		const key = c.req.query('key');
		if (key === undefined || key === '') {
			return c.json({error: 'Missing key parameter'}, 400);
		}
		const filename = key.split('/').pop() ?? key;
		try {
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
		} catch (err) {
			process.stderr.write(
				`GET /api/buckets/${bucket}/download error: ${err instanceof Error ? err.message : 'unknown error'}\n`,
			);
			return c.json({error: 'Failed to download object'}, 500);
		}
	});

	app.post('/api/buckets/:bucket/upload', async (c) => {
		const {bucket} = c.req.param();
		const prefix = c.req.query('prefix') ?? '';
		let formData: FormData;
		try {
			formData = await c.req.formData();
		} catch {
			return c.json({error: 'Invalid form data'}, 400);
		}
		const files = formData.getAll('file');
		if (files.length === 0) {
			return c.json({error: 'No files provided'}, 400);
		}
		try {
			for (const file of files) {
				if (!(file instanceof File)) {
					continue;
				}
				const key = prefix + file.name;
				const body = new Uint8Array(await file.arrayBuffer());
				const contentType = file.type !== '' ? file.type : undefined;
				await storage.putObject(bucket, key, body, contentType);
			}
			return c.json({ok: true});
		} catch (err) {
			process.stderr.write(
				`POST /api/buckets/${bucket}/upload error: ${err instanceof Error ? err.message : 'unknown error'}\n`,
			);
			return c.json({error: 'Upload failed'}, 500);
		}
	});

	app.delete('/api/buckets/:bucket/object', async (c) => {
		const {bucket} = c.req.param();
		const key = c.req.query('key');
		if (key === undefined || key === '') {
			return c.json({error: 'Missing key parameter'}, 400);
		}
		try {
			await storage.deleteObject(bucket, key);
			return c.json({ok: true});
		} catch (err) {
			process.stderr.write(
				`DELETE /api/buckets/${bucket}/object error: ${err instanceof Error ? err.message : 'unknown error'}\n`,
			);
			return c.json({error: 'Failed to delete object'}, 500);
		}
	});

	app.delete('/api/buckets/:bucket/folder', async (c) => {
		const {bucket} = c.req.param();
		const prefix = c.req.query('prefix');
		if (prefix === undefined || prefix === '') {
			return c.json({error: 'Missing prefix parameter'}, 400);
		}
		try {
			const keys = await storage.listAllObjects(bucket, prefix);
			if (keys.length > 0) {
				await storage.deleteObjects(bucket, keys);
			}
			return c.json({ok: true});
		} catch (err) {
			process.stderr.write(
				`DELETE /api/buckets/${bucket}/folder error: ${err instanceof Error ? err.message : 'unknown error'}\n`,
			);
			return c.json({error: 'Failed to delete folder'}, 500);
		}
	});

	app.get('/api/buckets/:bucket/download-folder', async (c) => {
		const {bucket} = c.req.param();
		const prefix = c.req.query('prefix') ?? '';
		const folderName = prefix.split('/').filter(Boolean).pop() ?? bucket;
		try {
			const keys = await storage.listAllObjects(bucket, prefix);
			const zipStream = buildZipStream(storage, bucket, keys, prefix);
			const headers = new Headers();
			headers.set('Content-Type', 'application/zip');
			headers.set(
				'Content-Disposition',
				`attachment; filename*=UTF-8''${encodeURIComponent(folderName)}.zip`,
			);
			return new Response(zipStream, {headers});
		} catch (err) {
			process.stderr.write(
				`GET /api/buckets/${bucket}/download-folder error: ${err instanceof Error ? err.message : 'unknown error'}\n`,
			);
			return c.json({error: 'Failed to create ZIP'}, 500);
		}
	});

	return app;
}
