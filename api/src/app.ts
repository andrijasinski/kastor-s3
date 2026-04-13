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
        `GET /api/buckets error: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      return c.json({ error: 'Failed to list buckets' }, 500);
    }
  });

  return app;
}
