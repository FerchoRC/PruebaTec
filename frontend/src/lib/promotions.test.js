import { describe, expect, it } from 'vitest';

import {
  canDelete,
  canEdit,
  formatDate,
  formatDiscount,
  formatMoney,
  isValidToday,
  nextStatus,
  STATUS,
  todayIso,
  validateForm,
} from './promotions.js';

const baseForm = {
  name: 'Promo',
  targetType: 'producto',
  productId: '1',
  categoryId: '',
  discountType: 'porcentaje',
  discountValue: '10',
  startDate: '2026-01-01',
  endDate: '2026-01-31',
};

describe('ciclo de vida', () => {
  it('avanza Programada -> Activa -> Finalizada y luego se detiene', () => {
    expect(nextStatus(STATUS.PROGRAMADA)).toBe(STATUS.ACTIVA);
    expect(nextStatus(STATUS.ACTIVA)).toBe(STATUS.FINALIZADA);
    expect(nextStatus(STATUS.FINALIZADA)).toBeNull();
  });

  it('solo permite borrar promociones programadas', () => {
    expect(canDelete({ status: STATUS.PROGRAMADA })).toBe(true);
    expect(canDelete({ status: STATUS.ACTIVA })).toBe(false);
    expect(canDelete({ status: STATUS.FINALIZADA })).toBe(false);
  });

  it('bloquea la edicion de las finalizadas', () => {
    expect(canEdit({ status: STATUS.ACTIVA })).toBe(true);
    expect(canEdit({ status: STATUS.FINALIZADA })).toBe(false);
  });
});

describe('vigencia', () => {
  const promo = { startDate: '2026-03-01', endDate: '2026-03-31' };

  it('incluye los extremos', () => {
    expect(isValidToday(promo, '2026-03-01')).toBe(true);
    expect(isValidToday(promo, '2026-03-31')).toBe(true);
  });

  it('excluye lo que queda fuera', () => {
    expect(isValidToday(promo, '2026-02-28')).toBe(false);
    expect(isValidToday(promo, '2026-04-01')).toBe(false);
  });
});

describe('formato', () => {
  it('distingue porcentaje de monto fijo', () => {
    expect(formatDiscount({ discountType: 'porcentaje', discountValue: 25 })).toBe('25 %');
    expect(formatDiscount({ discountType: 'monto_fijo', discountValue: 5 })).toBe('$ 5');
  });

  it('muestra los montos fijos en pesos colombianos', () => {
    const cop = (discountValue) => formatDiscount({ discountType: 'monto_fijo', discountValue });

    expect(cop(1500)).toBe('$ 1.500');
    expect(cop(25000)).toBe('$ 25.000');
    expect(cop(1234567)).toBe('$ 1.234.567');
  });

  it('solo pinta centavos cuando el valor los tiene', () => {
    expect(formatMoney(25000)).toBe('$ 25.000');
    expect(formatMoney(1500.5)).toBe('$ 1.500,50');
    expect(formatMoney(999.99)).toBe('$ 999,99');
  });

  it('muestra la fecha en formato local sin desplazar el dia', () => {
    expect(formatDate('2026-04-01')).toBe('01/04/2026');
    expect(formatDate(null)).toBe('-');
  });

  it('todayIso usa el calendario local', () => {
    expect(todayIso(new Date(2026, 11, 31, 22, 0))).toBe('2026-12-31');
  });
});

describe('validateForm', () => {
  it('no reporta errores en un formulario correcto', () => {
    expect(validateForm(baseForm)).toEqual({});
  });

  it('exige nombre, objetivo y valor', () => {
    const errors = validateForm({
      ...baseForm,
      name: '  ',
      productId: '',
      discountValue: '',
    });
    expect(errors).toHaveProperty('name');
    expect(errors).toHaveProperty('productId');
    expect(errors).toHaveProperty('discountValue');
  });

  it('exige que la fecha de fin sea posterior', () => {
    expect(validateForm({ ...baseForm, endDate: '2026-01-01' })).toHaveProperty('endDate');
  });

  it('limita el porcentaje al rango 1-100', () => {
    expect(validateForm({ ...baseForm, discountValue: '0' })).toHaveProperty('discountValue');
    expect(validateForm({ ...baseForm, discountValue: '101' })).toHaveProperty('discountValue');
    expect(validateForm({ ...baseForm, discountValue: '100' })).toEqual({});
  });

  it('no aplica el limite de 100 a los montos fijos', () => {
    expect(
      validateForm({ ...baseForm, discountType: 'monto_fijo', discountValue: '250' }),
    ).toEqual({});
  });

  it('exige categoria cuando el objetivo es una categoria', () => {
    expect(
      validateForm({ ...baseForm, targetType: 'categoria', productId: '', categoryId: '' }),
    ).toHaveProperty('categoryId');
  });
});
