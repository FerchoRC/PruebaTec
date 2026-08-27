import { Router } from 'express';
import {
  assertDeletable,
  assertEditable,
  assertStatusTransition,
  buildSummary,
  todayIso,
  validatePromotionInput,
} from '../domain/promotion.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, `Identificador invalido: ${raw}`);
  }
  return id;
}

async function loadPromotion(repo, raw) {
  const promotion = await repo.findById(parseId(raw));
  if (!promotion) throw new HttpError(404, 'La promocion no existe.');
  return promotion;
}

export function createPromotionsRouter(promotionRepo, catalogRepo) {
  const router = Router();

  router.get(
    '/catalog',
    asyncHandler(async (req, res) => {
      const [categories, products] = await Promise.all([
        catalogRepo.categories(),
        catalogRepo.products(),
      ]);
      res.json({ categories, products });
    }),
  );

  router.get(
    '/promotions/summary',
    asyncHandler(async (req, res) => {
      const promotions = await promotionRepo.list();
      res.json(buildSummary(promotions, todayIso()));
    }),
  );

  router.get(
    '/promotions',
    asyncHandler(async (req, res) => {
      const promotions = await promotionRepo.list();
      const today = todayIso();
      res.json({
        today,
        items: promotions,
      });
    }),
  );

  router.get(
    '/promotions/:id',
    asyncHandler(async (req, res) => {
      res.json(await loadPromotion(promotionRepo, req.params.id));
    }),
  );

  router.post(
    '/promotions',
    asyncHandler(async (req, res) => {
      const data = validatePromotionInput(req.body);
      await assertTargetExists(promotionRepo, data);
      const created = await promotionRepo.create(data);
      res.status(201).json(created);
    }),
  );

  router.put(
    '/promotions/:id',
    asyncHandler(async (req, res) => {
      const existing = await loadPromotion(promotionRepo, req.params.id);
      assertEditable(existing);
      const data = validatePromotionInput(req.body);
      await assertTargetExists(promotionRepo, data);
      res.json(await promotionRepo.update(existing.id, data));
    }),
  );

  router.patch(
    '/promotions/:id/status',
    asyncHandler(async (req, res) => {
      const existing = await loadPromotion(promotionRepo, req.params.id);
      assertEditable(existing);
      const next = assertStatusTransition(existing.status, req.body?.status);
      res.json(await promotionRepo.updateStatus(existing.id, next));
    }),
  );

  router.delete(
    '/promotions/:id',
    asyncHandler(async (req, res) => {
      const existing = await loadPromotion(promotionRepo, req.params.id);
      assertDeletable(existing);
      await promotionRepo.remove(existing.id);
      res.status(204).send();
    }),
  );

  return router;
}

async function assertTargetExists(repo, data) {
  const targetId = data.targetType === 'producto' ? data.productId : data.categoryId;
  const exists = await repo.targetExists(data.targetType, targetId);
  if (!exists) {
    throw new HttpError(422, `El ${data.targetType} indicado (id ${targetId}) no existe.`);
  }
}
