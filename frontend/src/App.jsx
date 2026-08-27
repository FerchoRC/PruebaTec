import { useCallback, useEffect, useState } from 'react';

import { PromotionForm } from './components/PromotionForm.jsx';
import { PromotionTable } from './components/PromotionTable.jsx';
import { SummaryPanel } from './components/SummaryPanel.jsx';
import { api, ApiError } from './lib/api.js';
import { todayIso } from './lib/promotions.js';

const EMPTY_CATALOG = { products: [], categories: [] };

function toFieldErrors(error) {
  if (!(error instanceof ApiError) || !Array.isArray(error.details)) return {};
  return Object.fromEntries(
    error.details.filter((detail) => detail.field).map((detail) => [detail.field, detail.message]),
  );
}

export default function App() {
  const [catalog, setCatalog] = useState(EMPTY_CATALOG);
  const [promotions, setPromotions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [today, setToday] = useState(todayIso());

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [editing, setEditing] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [errorMessage, setErrorMessage] = useState(null);

  const refresh = useCallback(async () => {
    const [list, nextSummary] = await Promise.all([api.listPromotions(), api.summary()]);
    setPromotions(list.items);
    setToday(list.today);
    setSummary(nextSummary);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [catalogData] = await Promise.all([api.catalog(), refresh()]);
        if (!cancelled) setCatalog(catalogData);
      } catch (error) {
        if (!cancelled) setErrorMessage(error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    setFieldErrors({});
    setErrorMessage(null);
    try {
      if (editing) {
        await api.updatePromotion(editing.id, payload);
      } else {
        await api.createPromotion(payload);
      }
      setEditing(null);
      await refresh();
    } catch (error) {
      setFieldErrors(toFieldErrors(error));
      setErrorMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const runRowAction = async (promotion, action) => {
    setBusyId(promotion.id);
    setErrorMessage(null);
    try {
      await action();
      await refresh();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleAdvance = (promotion, next) =>
    runRowAction(promotion, () => api.changeStatus(promotion.id, next));

  const handleDelete = (promotion) => {
    if (!window.confirm(`Eliminar la promocion "${promotion.name}"?`)) return;
    if (editing?.id === promotion.id) setEditing(null);
    return runRowAction(promotion, () => api.deletePromotion(promotion.id));
  };

  const handleEdit = (promotion) => {
    setEditing(promotion);
    setFieldErrors({});
    setErrorMessage(null);
  };

  return (
    <div className="layout">
      <header className="header">
        <div>
          <h1>Gestion de Promociones</h1>
        </div>
      </header>

      {errorMessage && (
        <div className="notice notice--error" role="alert">
          {errorMessage}
          <button type="button" className="notice__close" onClick={() => setErrorMessage(null)}>
            &times;
          </button>
        </div>
      )}

      <SummaryPanel summary={summary} />

      <main className="content">
        <PromotionForm
          catalog={catalog}
          editing={editing}
          serverErrors={fieldErrors}
          submitting={submitting}
          onSubmit={handleSubmit}
          onCancel={() => setEditing(null)}
        />

        {loading ? (
          <div className="panel empty">
            <p>Cargando promociones...</p>
          </div>
        ) : (
          <PromotionTable
            promotions={promotions}
            today={today}
            busyId={busyId}
            onAdvance={handleAdvance}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      </main>
    </div>
  );
}
