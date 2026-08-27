import { formatDate } from '../lib/promotions.js';

const CARDS = [
  { key: 'Programada', label: 'Programadas', tone: 'programada' },
  { key: 'Activa', label: 'Activas', tone: 'activa' },
  { key: 'Finalizada', label: 'Finalizadas', tone: 'finalizada' },
];

export function SummaryPanel({ summary }) {
  if (!summary) return null;

  return (
    <section className="summary" aria-label="Resumen de promociones">
      {CARDS.map((card) => (
        <article key={card.key} className={`card card--${card.tone}`}>
          <span className="card__value">{summary.byStatus?.[card.key] ?? 0}</span>
          <span className="card__label">{card.label}</span>
        </article>
      ))}

      <article className="card card--vigentes">
        <span className="card__value">{summary.validToday ?? 0}</span>
        <span className="card__label">
          Vigentes hoy
          <small>{formatDate(summary.today)}</small>
        </span>
      </article>
    </section>
  );
}
