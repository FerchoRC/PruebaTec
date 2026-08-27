import express from 'express';
import cors from 'cors';

import { createHealthRouter } from './routes/health.js';
import { createPromotionsRouter } from './routes/promotions.js';
import {
  createCatalogRepository,
  createPromotionRepository,
} from './repositories/promotionRepository.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp({ pool, corsOrigin = '*', repositories } = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: '100kb' }));

  const promotionRepo = repositories?.promotions ?? createPromotionRepository(pool);
  const catalogRepo = repositories?.catalog ?? createCatalogRepository(pool);

  app.use(createHealthRouter(pool));
  app.use('/api', createPromotionsRouter(promotionRepo, catalogRepo));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
