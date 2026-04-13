import { Hono } from 'hono';
import { Zip, ZipPassThrough } from 'fflate';
import type { Storage } from './storage';

function buildZipStream(storage: Storage, bucket: string, keys: string[], prefix: string): ReadableStream<Uint8Array> {
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
          const { body } = await storage.getObjectStream(bucket, key);
          const reader = body.getReader();
          while (true) {
            const { done, value } = await reader.read();
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
      return c.json({ buckets });
    } catch (err) {
      process.stderr.write(
        `GET /api/buckets error: ${err instanceof Error ? err.message : 'unknown error'}\n`,
      );
      return c.json({ error: 'Failed to list buckets' }, 500);
    }
  });

  app.get('/api/buckets/:bucket/objects', async (c) => {
    const { bucket } = c.req.param();
    const prefix = c.req.query('prefix') ?? '';
    try {
      const objects = await storage.listObjects(bucket, prefix);
      return c.json({ objects });
    } catch (err) {
      process.stderr.write(
        `GET /api/buckets/${bucket}/objects error: ${err instanceof Error ? err.message : 'unknown error'}\n`,
      );
      return c.json({ error: 'Failed to list objects' }, 500);
    }
  });

  app.get('/api/buckets/:bucket/objects-all', async (c) => {
    const { bucket } = c.req.param();
    const prefix = c.req.query('prefix') ?? '';
    try {
      const keys = await storage.listAllObjects(bucket, prefix);
      return c.json({ keys });
    } catch (err) {
      process.stderr.write(
        `GET /api/buckets/${bucket}/objects-all error: ${err instanceof Error ? err.message : 'unknown error'}\n`,
      );
      return c.json({ error: 'Failed to list objects' }, 500);
    }
  });

  app.get('/api/buckets/:bucket/download', async (c) => {
    const { bucket } = c.req.param();
    const key = c.req.query('key');
    if (key === undefined || key === '') {
      return c.json({ error: 'Missing key parameter' }, 400);
    }
    const filename = key.split('/').pop() ?? key;
    try {
      const { body, contentType, contentLength } = await storage.getObjectStream(bucket, key);
      const headers: Record<string, string> = {
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      };
      if (contentType !== undefined) {
        headers['Content-Type'] = contentType;
      }
      if (contentLength !== undefined) {
        headers['Content-Length'] = contentLength.toString();
      }
      return new Response(body, { headers });
    } catch (err) {
      process.stderr.write(
        `GET /api/buckets/${bucket}/download error: ${err instanceof Error ? err.message : 'unknown error'}\n`,
      );
      return c.json({ error: 'Failed to download object' }, 500);
    }
  });

  app.get('/api/buckets/:bucket/download-folder', async (c) => {
    const { bucket } = c.req.param();
    const prefix = c.req.query('prefix') ?? '';
    const folderName = prefix.split('/').filter(Boolean).pop() ?? bucket;
    try {
      const keys = await storage.listAllObjects(bucket, prefix);
      const zipStream = buildZipStream(storage, bucket, keys, prefix);
      return new Response(zipStream, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(folderName)}.zip`,
        },
      });
    } catch (err) {
      process.stderr.write(
        `GET /api/buckets/${bucket}/download-folder error: ${err instanceof Error ? err.message : 'unknown error'}\n`,
      );
      return c.json({ error: 'Failed to create ZIP' }, 500);
    }
  });

  return app;
}
