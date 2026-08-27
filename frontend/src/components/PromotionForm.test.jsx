import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PromotionForm } from './PromotionForm.jsx';

const catalog = {
  products: [{ id: 1, name: 'Cafe molido 500g', sku: 'BEB-001' }],
  categories: [{ id: 7, name: 'Bebidas' }],
};

function renderForm(props = {}) {
  const onSubmit = vi.fn();
  render(
    <PromotionForm
      catalog={catalog}
      editing={null}
      serverErrors={{}}
      submitting={false}
      onSubmit={onSubmit}
      onCancel={vi.fn()}
      {...props}
    />,
  );
  return { onSubmit };
}

describe('PromotionForm', () => {
  it('no envia y muestra los errores cuando faltan datos obligatorios', async () => {
    const { onSubmit } = renderForm();

    await userEvent.click(screen.getByRole('button', { name: /crear promocion/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('El nombre es obligatorio.')).toBeInTheDocument();
    expect(screen.getByText('Debe seleccionar un producto.')).toBeInTheDocument();
  });

  it('rechaza un porcentaje mayor que 100 sin llamar a la API', async () => {
    const { onSubmit } = renderForm();

    await userEvent.type(screen.getByLabelText('Nombre'), 'Promo');
    await userEvent.selectOptions(screen.getByLabelText('Producto'), '1');
    await userEvent.type(screen.getByLabelText(/valor/i), '150');
    await userEvent.type(screen.getByLabelText('Fecha de inicio'), '2026-04-01');
    await userEvent.type(screen.getByLabelText('Fecha de fin'), '2026-04-30');

    await userEvent.click(screen.getByRole('button', { name: /crear promocion/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Un porcentaje debe estar entre 1 y 100.')).toBeInTheDocument();
  });

  it('rechaza una fecha de fin anterior a la de inicio', async () => {
    const { onSubmit } = renderForm();

    await userEvent.type(screen.getByLabelText('Nombre'), 'Promo');
    await userEvent.selectOptions(screen.getByLabelText('Producto'), '1');
    await userEvent.type(screen.getByLabelText(/valor/i), '10');
    await userEvent.type(screen.getByLabelText('Fecha de inicio'), '2026-04-30');
    await userEvent.type(screen.getByLabelText('Fecha de fin'), '2026-04-01');

    await userEvent.click(screen.getByRole('button', { name: /crear promocion/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('La fecha de fin debe ser posterior a la de inicio.')).toBeInTheDocument();
  });

  it('envia un payload normalizado cuando todo es valido', async () => {
    const { onSubmit } = renderForm();

    await userEvent.type(screen.getByLabelText('Nombre'), '  Rebaja  ');
    await userEvent.selectOptions(screen.getByLabelText('Producto'), '1');
    await userEvent.type(screen.getByLabelText(/valor/i), '15');
    await userEvent.type(screen.getByLabelText('Fecha de inicio'), '2026-04-01');
    await userEvent.type(screen.getByLabelText('Fecha de fin'), '2026-04-30');

    await userEvent.click(screen.getByRole('button', { name: /crear promocion/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Rebaja',
      targetType: 'producto',
      productId: 1,
      categoryId: null,
      discountType: 'porcentaje',
      discountValue: 15,
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    });
  });

  it('cambia el selector al elegir categoria como objetivo', async () => {
    renderForm();

    await userEvent.selectOptions(screen.getByLabelText('Aplica a'), 'categoria');

    expect(screen.getByLabelText('Categoria')).toBeInTheDocument();
    expect(screen.queryByLabelText('Producto')).not.toBeInTheDocument();
  });

  it('precarga los datos al editar y muestra el boton de cancelar', () => {
    renderForm({
      editing: {
        id: 3,
        name: 'Promo existente',
        targetType: 'producto',
        productId: 1,
        discountType: 'monto_fijo',
        discountValue: 12.5,
        startDate: '2026-05-01',
        endDate: '2026-05-31',
      },
    });

    expect(screen.getByLabelText('Nombre')).toHaveValue('Promo existente');
    expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
  });

  it('muestra los errores por campo que devuelve el backend', () => {
    renderForm({ serverErrors: { name: 'Ese nombre ya existe.' } });
    expect(screen.getByText('Ese nombre ya existe.')).toBeInTheDocument();
  });
});
