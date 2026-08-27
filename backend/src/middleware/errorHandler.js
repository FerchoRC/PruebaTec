import { ValidationError } from '../domain/promotion.js';

export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(error, req, res, _next) {
  if (error instanceof ValidationError) {
    return res.status(error.status).json({
      error: error.message,
      details: error.details,
    });
  }

  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message });
  }

  if (error.code === '23514' || error.code === '23503') {
    return res.status(409).json({
      error: 'La operacion viola una restriccion de integridad de la base de datos.',
      details: [{ constraint: error.constraint ?? null }],
    });
  }

  console.error('[error] no controlado:', error);
  return res.status(500).json({ error: 'Error interno del servidor.' });
}
