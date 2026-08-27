import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PromotionTable } from './PromotionTable.jsx';

const promotion = (overrides = {}) => ({
  id: 1,
  name: 'Rebaja de marzo',
  targetType: 'producto',
  targetName: 'Cafe molido 500g',
  discountType: 'porcentaje',
  discountValue: 20,
  startDate: '2026-03-01',
  endDate: '2026-03-31',
  status: 'Programada',
  ...overrides,
});

function renderTable(promotions, props = {}) {
  const handlers = {
    onAdvance: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    ...props,
  };
  render(
    <PromotionTable promotions={promotions} today="2026-03-15" busyId={null} {...handlers} />,
  );
  return handlers;
}

describe('PromotionTable', () => {
  it('muestra un mensaje cuando no hay promociones', () => {
    renderTable([]);
    expect(screen.getByText(/todavia no hay promociones/i)).toBeInTheDocument();
  });

  it('pinta los datos principales de cada promocion', () => {
    renderTable([promotion()]);

    expect(screen.getByText('Rebaja de marzo')).toBeInTheDocument();
    expect(screen.getByText('Producto: Cafe molido 500g')).toBeInTheDocument();
    expect(screen.getByText('20 %')).toBeInTheDocument();
    expect(screen.getByText('Programada')).toBeInTheDocument();
  });

  it('marca como vigente la promocion cuyo rango incluye hoy', () => {
    renderTable([promotion(), promotion({ id: 2, startDate: '2026-06-01', endDate: '2026-06-30' })]);
    expect(screen.getAllByText('Vigente hoy')).toHaveLength(1);
  });

  it('ofrece el siguiente estado del ciclo de vida', () => {
    renderTable([promotion({ status: 'Activa' })]);
    expect(screen.getByRole('button', { name: /pasar a finalizada/i })).toBeInTheDocument();
  });

  it('no ofrece transicion para una promocion finalizada', () => {
    renderTable([promotion({ status: 'Finalizada' })]);
    expect(screen.queryByRole('button', { name: /pasar a/i })).not.toBeInTheDocument();
  });

  it('deshabilita eliminar salvo en estado Programada', () => {
    renderTable([promotion({ status: 'Activa' })]);
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeDisabled();
  });

  it('deshabilita editar en una promocion finalizada', () => {
    renderTable([promotion({ status: 'Finalizada' })]);
    expect(screen.getByRole('button', { name: 'Editar' })).toBeDisabled();
  });

  it('avisa al padre al avanzar de estado', async () => {
    const { onAdvance } = renderTable([promotion()]);

    await userEvent.click(screen.getByRole('button', { name: /pasar a activa/i }));

    expect(onAdvance).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), 'Activa');
  });
});
