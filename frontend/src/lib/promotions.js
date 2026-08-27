export const STATUS = Object.freeze({
  PROGRAMADA: 'Programada',
  ACTIVA: 'Activa',
  FINALIZADA: 'Finalizada',
});

export function nextStatus(status) {
  if (status === STATUS.PROGRAMADA) return STATUS.ACTIVA;
  if (status === STATUS.ACTIVA) return STATUS.FINALIZADA;
  return null;
}

export function canDelete(promotion) {
  return promotion.status === STATUS.PROGRAMADA;
}

export function canEdit(promotion) {
  return promotion.status !== STATUS.FINALIZADA;
}

export function isValidToday(promotion, today) {
  if (!promotion.startDate || !promotion.endDate) return false;
  return promotion.startDate <= today && today <= promotion.endDate;
}

const PESOS_ENTEROS = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const PESOS_CON_CENTAVOS = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(value) {
  const formatter = Number.isInteger(value) ? PESOS_ENTEROS : PESOS_CON_CENTAVOS;
  return `$ ${formatter.format(value)}`;
}

export function formatDiscount(promotion) {
  const value = Number(promotion.discountValue);
  if (!Number.isFinite(value)) return '-';
  return promotion.discountType === 'porcentaje' ? `${value} %` : formatMoney(value);
}

export function formatDate(isoDate) {
  if (typeof isoDate !== 'string' || isoDate.length < 10) return '-';
  const [year, month, day] = isoDate.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

export function formatTarget(promotion) {
  const label = promotion.targetType === 'producto' ? 'Producto' : 'Categoria';
  return `${label}: ${promotion.targetName ?? '-'}`;
}

export function validateForm(form) {
  const errors = {};

  if (!form.name || !form.name.trim()) {
    errors.name = 'El nombre es obligatorio.';
  }

  if (form.targetType === 'producto' && !form.productId) {
    errors.productId = 'Debe seleccionar un producto.';
  }
  if (form.targetType === 'categoria' && !form.categoryId) {
    errors.categoryId = 'Debe seleccionar una categoria.';
  }

  const value = Number(form.discountValue);
  if (form.discountValue === '' || form.discountValue === null) {
    errors.discountValue = 'El valor del descuento es obligatorio.';
  } else if (!Number.isFinite(value) || value <= 0) {
    errors.discountValue = 'El valor debe ser un numero mayor que 0.';
  } else if (form.discountType === 'porcentaje' && (value < 1 || value > 100)) {
    errors.discountValue = 'Un porcentaje debe estar entre 1 y 100.';
  }

  if (!form.startDate) errors.startDate = 'La fecha de inicio es obligatoria.';
  if (!form.endDate) errors.endDate = 'La fecha de fin es obligatoria.';
  if (form.startDate && form.endDate && form.endDate <= form.startDate) {
    errors.endDate = 'La fecha de fin debe ser posterior a la de inicio.';
  }

  return errors;
}

export function todayIso(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
