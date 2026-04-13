import { Hono } from 'hono';
import type { Storage } from './storage';

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

  return app;
}
