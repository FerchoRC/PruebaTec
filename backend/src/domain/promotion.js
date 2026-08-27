export const STATUS = Object.freeze({
  PROGRAMADA: 'Programada',
  ACTIVA: 'Activa',
  FINALIZADA: 'Finalizada',
});

export const STATUSES = Object.freeze([STATUS.PROGRAMADA, STATUS.ACTIVA, STATUS.FINALIZADA]);

export const DISCOUNT_TYPE = Object.freeze({
  PORCENTAJE: 'porcentaje',
  MONTO_FIJO: 'monto_fijo',
});

export const TARGET_TYPE = Object.freeze({
  PRODUCTO: 'producto',
  CATEGORIA: 'categoria',
});

const ALLOWED_TRANSITIONS = Object.freeze({
  [STATUS.PROGRAMADA]: [STATUS.ACTIVA],
  [STATUS.ACTIVA]: [STATUS.FINALIZADA],
  [STATUS.FINALIZADA]: [],
});

export class ValidationError extends Error {
  constructor(message, { status = 422, details = [] } = {}) {
    super(message);
    this.name = 'ValidationError';
    this.status = status;
    this.details = details;
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function toIsoDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string') return value.slice(0, 10);
  return null;
}

function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function toPositiveInt(value) {
  if (isBlank(value)) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export function validatePromotionInput(input = {}) {
  const errors = [];

  const name = isBlank(input.name) ? '' : String(input.name).trim();
  if (!name) {
    errors.push({ field: 'name', message: 'El nombre es obligatorio.' });
  } else if (name.length > 120) {
    errors.push({ field: 'name', message: 'El nombre no puede exceder 120 caracteres.' });
  }

  const targetType = isBlank(input.targetType) ? '' : String(input.targetType).trim();
  let productId = null;
  let categoryId = null;

  if (targetType !== TARGET_TYPE.PRODUCTO && targetType !== TARGET_TYPE.CATEGORIA) {
    errors.push({
      field: 'targetType',
      message: 'Debe indicar si la promocion aplica a un producto o a una categoria.',
    });
  } else if (targetType === TARGET_TYPE.PRODUCTO) {
    productId = toPositiveInt(input.productId);
    if (productId === null) {
      errors.push({ field: 'productId', message: 'Debe seleccionar un producto.' });
    }
  } else {
    categoryId = toPositiveInt(input.categoryId);
    if (categoryId === null) {
      errors.push({ field: 'categoryId', message: 'Debe seleccionar una categoria.' });
    }
  }

  const discountType = isBlank(input.discountType) ? '' : String(input.discountType).trim();
  const isPercentage = discountType === DISCOUNT_TYPE.PORCENTAJE;
  const isFixed = discountType === DISCOUNT_TYPE.MONTO_FIJO;

  if (!isPercentage && !isFixed) {
    errors.push({
      field: 'discountType',
      message: 'El tipo de descuento debe ser porcentaje o monto_fijo.',
    });
  }

  let discountValue = null;
  if (isBlank(input.discountValue)) {
    errors.push({ field: 'discountValue', message: 'El valor del descuento es obligatorio.' });
  } else {
    discountValue = Number(input.discountValue);
    if (!Number.isFinite(discountValue)) {
      errors.push({ field: 'discountValue', message: 'El valor del descuento debe ser numerico.' });
      discountValue = null;
    } else if (discountValue <= 0) {
      errors.push({
        field: 'discountValue',
        message: 'El valor del descuento debe ser mayor que 0.',
      });
    } else if (isPercentage && (discountValue < 1 || discountValue > 100)) {
      errors.push({
        field: 'discountValue',
        message: 'Un descuento por porcentaje debe estar entre 1 y 100.',
      });
    }
  }

  const startDate = toIsoDate(input.startDate);
  const endDate = toIsoDate(input.endDate);

  if (!isValidDate(startDate)) {
    errors.push({ field: 'startDate', message: 'La fecha de inicio es obligatoria (YYYY-MM-DD).' });
  }
  if (!isValidDate(endDate)) {
    errors.push({ field: 'endDate', message: 'La fecha de fin es obligatoria (YYYY-MM-DD).' });
  }
  if (isValidDate(startDate) && isValidDate(endDate) && endDate <= startDate) {
    errors.push({
      field: 'endDate',
      message: 'La fecha de fin debe ser posterior a la fecha de inicio.',
    });
  }

  if (errors.length > 0) {
    throw new ValidationError('La promocion tiene datos invalidos.', { details: errors });
  }

  return {
    name,
    targetType,
    productId,
    categoryId,
    discountType,
    discountValue,
    startDate,
    endDate,
  };
}

export function assertStatusTransition(current, next) {
  if (!STATUSES.includes(next)) {
    throw new ValidationError(`Estado desconocido: ${next}`, { status: 400 });
  }
  if (current === next) {
    throw new ValidationError(`La promocion ya se encuentra en estado ${current}.`, {
      status: 409,
    });
  }
  const allowed = ALLOWED_TRANSITIONS[current] ?? [];
  if (!allowed.includes(next)) {
    throw new ValidationError(
      `Transicion no permitida (${current} -> ${next}). ` +
        'El flujo valido es Programada -> Activa -> Finalizada.',
      { status: 409 },
    );
  }
  return next;
}

export function assertEditable(promotion) {
  if (promotion.status === STATUS.FINALIZADA) {
    throw new ValidationError('Una promocion finalizada no puede modificarse.', { status: 409 });
  }
  return promotion;
}

export function assertDeletable(promotion) {
  if (promotion.status !== STATUS.PROGRAMADA) {
    throw new ValidationError(
      `Solo se pueden eliminar promociones en estado ${STATUS.PROGRAMADA}. ` +
        `Esta se encuentra en ${promotion.status}.`,
      { status: 409 },
    );
  }
  return promotion;
}

export function isCurrentlyValid(promotion, today) {
  const start = toIsoDate(promotion.startDate ?? promotion.start_date);
  const end = toIsoDate(promotion.endDate ?? promotion.end_date);
  if (!start || !end) return false;
  return start <= today && today <= end;
}

export function todayIso(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildSummary(promotions, today) {
  const summary = {
    total: promotions.length,
    byStatus: {
      [STATUS.PROGRAMADA]: 0,
      [STATUS.ACTIVA]: 0,
      [STATUS.FINALIZADA]: 0,
    },
    validToday: 0,
    today,
  };

  for (const promotion of promotions) {
    if (summary.byStatus[promotion.status] !== undefined) {
      summary.byStatus[promotion.status] += 1;
    }
    if (isCurrentlyValid(promotion, today)) summary.validToday += 1;
  }

  return summary;
}
