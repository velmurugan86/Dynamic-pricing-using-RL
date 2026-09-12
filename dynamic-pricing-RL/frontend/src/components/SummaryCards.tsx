import type { EpisodeSummary } from '../types'

interface Props {
  summary: EpisodeSummary
  policy: string
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export default function SummaryCards({ summary, policy }: Props) {
  const sellThrough =
    summary.initial_inventory > 0
      ? (summary.total_units_sold / summary.initial_inventory) * 100
      : 0

  return (
    <section className="cards">
      <div className="card">
        <span className="card-label">Total revenue</span>
        <span className="card-value">{fmt(summary.total_revenue)}</span>
      </div>
      <div className="card">
        <span className="card-label">Units sold</span>
        <span className="card-value">
          {summary.total_units_sold}
          <span className="card-sub"> / {summary.initial_inventory} ({sellThrough.toFixed(0)}%)</span>
        </span>
      </div>
      <div className="card">
        <span className="card-label">Avg price</span>
        <span className="card-value">{fmt(summary.average_price)}</span>
        <span className="card-sub">
          {fmt(summary.min_price)} – {fmt(summary.max_price)}
        </span>
      </div>
      <div className="card">
        <span className="card-label">Steps</span>
        <span className="card-value">{summary.steps}</span>
      </div>
      <div className="card">
        <span className="card-label">Outcome</span>
        <span className={`card-value ${summary.terminated ? 'good' : ''}`}>
          {summary.terminated ? 'Sold out' : 'Time up'}
        </span>
        <span className="card-sub">policy: {policy}</span>
      </div>
    </section>
  )
}
