import { useEffect, useState } from 'react';

import { validateForm } from '../lib/promotions.js';

const EMPTY_FORM = {
  name: '',
  targetType: 'producto',
  productId: '',
  categoryId: '',
  discountType: 'porcentaje',
  discountValue: '',
  startDate: '',
  endDate: '',
};

function toFormState(promotion) {
  if (!promotion) return EMPTY_FORM;
  return {
    name: promotion.name ?? '',
    targetType: promotion.targetType ?? 'producto',
    productId: promotion.productId ? String(promotion.productId) : '',
    categoryId: promotion.categoryId ? String(promotion.categoryId) : '',
    discountType: promotion.discountType ?? 'porcentaje',
    discountValue: String(promotion.discountValue ?? ''),
    startDate: promotion.startDate ?? '',
    endDate: promotion.endDate ?? '',
  };
}

export function PromotionForm({ catalog, editing, serverErrors, submitting, onSubmit, onCancel }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setForm(toFormState(editing));
    setErrors({});
  }, [editing]);

  const allErrors = { ...serverErrors, ...errors };

  const update = (field) => (event) => {
    const { value } = event.target;
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleTargetTypeChange = (event) => {
    const targetType = event.target.value;
    setForm((current) => ({ ...current, targetType, productId: '', categoryId: '' }));
    setErrors({});
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const found = validateForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    onSubmit({
      name: form.name.trim(),
      targetType: form.targetType,
      productId: form.targetType === 'producto' ? Number(form.productId) : null,
      categoryId: form.targetType === 'categoria' ? Number(form.categoryId) : null,
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      startDate: form.startDate,
      endDate: form.endDate,
    });
  };

  const handleCancel = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    onCancel();
  };

  return (
    <form className="panel form" onSubmit={handleSubmit} noValidate>
      <h2>{editing ? `Editando: ${editing.name}` : 'Nueva promocion'}</h2>

      <Field label="Nombre" error={allErrors.name} htmlFor="name">
        <input
          id="name"
          type="text"
          value={form.name}
          onChange={update('name')}
          maxLength={120}
        />
      </Field>

      <div className="form__row">
        <Field label="Aplica a" htmlFor="targetType">
          <select id="targetType" value={form.targetType} onChange={handleTargetTypeChange}>
            <option value="producto">Producto</option>
            <option value="categoria">Categoria</option>
          </select>
        </Field>

        {form.targetType === 'producto' ? (
          <Field label="Producto" error={allErrors.productId} htmlFor="productId">
            <select id="productId" value={form.productId} onChange={update('productId')}>
              <option value="">Seleccione...</option>
              {catalog.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Categoria" error={allErrors.categoryId} htmlFor="categoryId">
            <select id="categoryId" value={form.categoryId} onChange={update('categoryId')}>
              <option value="">Seleccione...</option>
              {catalog.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      <div className="form__row">
        <Field label="Tipo de descuento" htmlFor="discountType">
          <select id="discountType" value={form.discountType} onChange={update('discountType')}>
            <option value="porcentaje">Porcentaje</option>
            <option value="monto_fijo">Monto fijo</option>
          </select>
        </Field>

        <Field label="Valor" error={allErrors.discountValue} htmlFor="discountValue">
          <input
            id="discountValue"
            type="number"
            step="0.01"
            min="0"
            value={form.discountValue}
            onChange={update('discountValue')}
          />
        </Field>
      </div>

      <div className="form__row">
        <Field label="Fecha de inicio" error={allErrors.startDate} htmlFor="startDate">
          <input id="startDate" type="date" value={form.startDate} onChange={update('startDate')} />
        </Field>

        <Field label="Fecha de fin" error={allErrors.endDate} htmlFor="endDate">
          <input id="endDate" type="date" value={form.endDate} onChange={update('endDate')} />
        </Field>
      </div>

      <div className="form__actions">
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {editing ? 'Guardar cambios' : 'Crear promocion'}
        </button>
        {editing && (
          <button type="button" className="btn" onClick={handleCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

function Field({ label, error, htmlFor, children }) {
  return (
    <label className={`field ${error ? 'field--error' : ''}`} htmlFor={htmlFor}>
      <span className="field__label">{label}</span>
      {children}
      {error && <span className="field__error">{error}</span>}
    </label>
  );
}
