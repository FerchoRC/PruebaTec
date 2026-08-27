import { Router } from 'express';
import { checkConnection } from '../db/pool.js';

export function createHealthRouter(pool) {
  const router = Router();

  router.get('/health', async (req, res) => {
    const startedAt = process.hrtime.bigint();
    try {
      await checkConnection(pool);
      const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      res.status(200).json({
        status: 'ok',
        database: 'up',
        latencyMs: Number(latencyMs.toFixed(2)),
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        status: 'error',
        database: 'down',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  return router;
}
