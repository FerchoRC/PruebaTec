import {
  canDelete,
  canEdit,
  formatDate,
  formatDiscount,
  formatTarget,
  isValidToday,
  nextStatus,
} from '../lib/promotions.js';

export function PromotionTable({ promotions, today, busyId, onAdvance, onEdit, onDelete }) {
  if (promotions.length === 0) {
    return (
      <div className="panel empty">
        <p>Todavia no hay promociones registradas.</p>
      </div>
    );
  }

  return (
    <div className="panel table-wrapper">
      <table className="table">
        <thead>
          <tr>
            <th>Promocion</th>
            <th>Aplica a</th>
            <th>Descuento</th>
            <th>Vigencia</th>
            <th>Estado</th>
            <th className="table__actions-head">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {promotions.map((promotion) => {
            const next = nextStatus(promotion.status);
            const busy = busyId === promotion.id;
            const vigente = isValidToday(promotion, today);

            return (
              <tr key={promotion.id}>
                <td>
                  <strong>{promotion.name}</strong>
                </td>
                <td>{formatTarget(promotion)}</td>
                <td>{formatDiscount(promotion)}</td>
                <td>
                  {formatDate(promotion.startDate)} &ndash; {formatDate(promotion.endDate)}
                  {vigente && <span className="tag tag--vigente">Vigente hoy</span>}
                </td>
                <td>
                  <span className={`badge badge--${promotion.status.toLowerCase()}`}>
                    {promotion.status}
                  </span>
                </td>
                <td className="table__actions">
                  {next && (
                    <button
                      type="button"
                      className="btn btn--small btn--primary"
                      disabled={busy}
                      onClick={() => onAdvance(promotion, next)}
                    >
                      Pasar a {next}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn--small"
                    disabled={busy || !canEdit(promotion)}
                    onClick={() => onEdit(promotion)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn btn--small btn--danger"
                    disabled={busy || !canDelete(promotion)}
                    title={
                      canDelete(promotion)
                        ? 'Eliminar promocion'
                        : 'Solo se pueden eliminar promociones programadas'
                    }
                    onClick={() => onDelete(promotion)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
