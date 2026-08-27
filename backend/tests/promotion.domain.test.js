import { describe, expect, it } from 'vitest';

import {
  assertDeletable,
  assertEditable,
  assertStatusTransition,
  buildSummary,
  isCurrentlyValid,
  STATUS,
  todayIso,
  validatePromotionInput,
  ValidationError,
} from '../src/domain/promotion.js';

const validInput = {
  name: 'Descuento de temporada',
  targetType: 'producto',
  productId: 1,
  discountType: 'porcentaje',
  discountValue: 20,
  startDate: '2026-01-01',
  endDate: '2026-01-31',
};

function fieldsInError(fn) {
  try {
    fn();
  } catch (error) {
    if (error instanceof ValidationError) return error.details.map((d) => d.field);
    throw error;
  }
  return [];
}

describe('validatePromotionInput', () => {
  it('acepta y normaliza un payload valido', () => {
    const result = validatePromotionInput({ ...validInput, name: '  Rebaja  ' });

    expect(result.name).toBe('Rebaja');
    expect(result.productId).toBe(1);
    expect(result.categoryId).toBeNull();
    expect(result.discountValue).toBe(20);
  });

  it('exige nombre, objetivo y valor de descuento', () => {
    const fields = fieldsInError(() =>
      validatePromotionInput({
        name: '   ',
        targetType: '',
        discountType: 'porcentaje',
        discountValue: '',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      }),
    );

    expect(fields).toContain('name');
    expect(fields).toContain('targetType');
    expect(fields).toContain('discountValue');
  });

  it('rechaza una fecha de fin anterior o igual a la de inicio', () => {
    expect(
      fieldsInError(() =>
        validatePromotionInput({ ...validInput, startDate: '2026-05-10', endDate: '2026-05-01' }),
      ),
    ).toContain('endDate');

    expect(
      fieldsInError(() =>
        validatePromotionInput({ ...validInput, startDate: '2026-05-10', endDate: '2026-05-10' }),
      ),
    ).toContain('endDate');
  });

  it.each([0, 0.5, 101, 250])('rechaza el porcentaje fuera de rango: %s', (value) => {
    expect(
      fieldsInError(() => validatePromotionInput({ ...validInput, discountValue: value })),
    ).toContain('discountValue');
  });

  it.each([1, 50, 100])('acepta el porcentaje dentro de rango: %s', (value) => {
    expect(validatePromotionInput({ ...validInput, discountValue: value }).discountValue).toBe(
      value,
    );
  });

  it('permite montos fijos por encima de 100', () => {
    const result = validatePromotionInput({
      ...validInput,
      discountType: 'monto_fijo',
      discountValue: 1500,
    });
    expect(result.discountValue).toBe(1500);
  });

  it('exige categoria cuando el objetivo es una categoria', () => {
    expect(
      fieldsInError(() =>
        validatePromotionInput({ ...validInput, targetType: 'categoria', productId: 1 }),
      ),
    ).toContain('categoryId');
  });

  it('ignora el producto cuando el objetivo es una categoria', () => {
    const result = validatePromotionInput({
      ...validInput,
      targetType: 'categoria',
      productId: 9,
      categoryId: 3,
    });

    expect(result.categoryId).toBe(3);
    expect(result.productId).toBeNull();
  });

  it('rechaza fechas con formato invalido', () => {
    const fields = fieldsInError(() =>
      validatePromotionInput({ ...validInput, startDate: '01/02/2026', endDate: '2026-13-45' }),
    );
    expect(fields).toEqual(expect.arrayContaining(['startDate', 'endDate']));
  });
});

describe('assertStatusTransition', () => {
  it('permite Programada -> Activa -> Finalizada', () => {
    expect(assertStatusTransition(STATUS.PROGRAMADA, STATUS.ACTIVA)).toBe(STATUS.ACTIVA);
    expect(assertStatusTransition(STATUS.ACTIVA, STATUS.FINALIZADA)).toBe(STATUS.FINALIZADA);
  });

  it('no permite saltarse Activa', () => {
    expect(() => assertStatusTransition(STATUS.PROGRAMADA, STATUS.FINALIZADA)).toThrow(
      ValidationError,
    );
  });

  it('no permite retroceder ni salir de Finalizada', () => {
    expect(() => assertStatusTransition(STATUS.ACTIVA, STATUS.PROGRAMADA)).toThrow(ValidationError);
    expect(() => assertStatusTransition(STATUS.FINALIZADA, STATUS.ACTIVA)).toThrow(ValidationError);
  });

  it('rechaza estados desconocidos y repetir el estado actual', () => {
    expect(() => assertStatusTransition(STATUS.PROGRAMADA, 'Pausada')).toThrow(ValidationError);
    expect(() => assertStatusTransition(STATUS.ACTIVA, STATUS.ACTIVA)).toThrow(ValidationError);
  });
});

describe('reglas de edicion y borrado', () => {
  it('bloquea la edicion de una promocion finalizada', () => {
    expect(() => assertEditable({ status: STATUS.FINALIZADA })).toThrow(ValidationError);
    expect(assertEditable({ status: STATUS.ACTIVA }).status).toBe(STATUS.ACTIVA);
  });

  it('solo deja eliminar promociones programadas', () => {
    expect(assertDeletable({ status: STATUS.PROGRAMADA }).status).toBe(STATUS.PROGRAMADA);
    expect(() => assertDeletable({ status: STATUS.ACTIVA })).toThrow(ValidationError);
    expect(() => assertDeletable({ status: STATUS.FINALIZADA })).toThrow(ValidationError);
  });
});

describe('vigencia y resumen', () => {
  const promo = { startDate: '2026-03-01', endDate: '2026-03-31' };

  it('incluye los extremos del rango', () => {
    expect(isCurrentlyValid(promo, '2026-03-01')).toBe(true);
    expect(isCurrentlyValid(promo, '2026-03-31')).toBe(true);
    expect(isCurrentlyValid(promo, '2026-03-15')).toBe(true);
  });

  it('excluye lo que cae fuera del rango', () => {
    expect(isCurrentlyValid(promo, '2026-02-28')).toBe(false);
    expect(isCurrentlyValid(promo, '2026-04-01')).toBe(false);
  });

  it('cuenta por estado y cuantas estan vigentes hoy', () => {
    const summary = buildSummary(
      [
        { status: STATUS.PROGRAMADA, startDate: '2026-06-01', endDate: '2026-06-30' },
        { status: STATUS.ACTIVA, startDate: '2026-03-01', endDate: '2026-03-31' },
        { status: STATUS.ACTIVA, startDate: '2026-03-10', endDate: '2026-04-10' },
        { status: STATUS.FINALIZADA, startDate: '2026-01-01', endDate: '2026-01-31' },
      ],
      '2026-03-15',
    );

    expect(summary.total).toBe(4);
    expect(summary.byStatus[STATUS.PROGRAMADA]).toBe(1);
    expect(summary.byStatus[STATUS.ACTIVA]).toBe(2);
    expect(summary.byStatus[STATUS.FINALIZADA]).toBe(1);
    expect(summary.validToday).toBe(2);
  });

  it('devuelve ceros cuando no hay promociones', () => {
    const summary = buildSummary([], '2026-03-15');
    expect(summary.total).toBe(0);
    expect(summary.validToday).toBe(0);
  });

  it('todayIso usa el calendario local y no desplaza el dia por UTC', () => {
    expect(todayIso(new Date(2026, 0, 1, 23, 30))).toBe('2026-01-01');
  });
});
