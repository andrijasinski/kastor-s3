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

  return app;
}
