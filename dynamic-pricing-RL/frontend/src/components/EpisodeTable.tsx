import { useMemo, useState } from 'react'
import type { StepRecord } from '../types'

export default function EpisodeTable({ steps }: { steps: StepRecord[] }) {
  const [showAll, setShowAll] = useState(false)

  const visible = useMemo(
    () => (showAll ? steps : steps.slice(0, 15)),
    [steps, showAll],
  )

  if (steps.length === 0) return null

  return (
    <section className="chart-card">
      <h3>Episode log</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Step</th>
              <th>Action</th>
              <th>Price</th>
              <th>Demand</th>
              <th>Sold</th>
              <th>Inventory</th>
              <th>Revenue</th>
              <th>Cumulative</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => (
              <tr key={s.step}>
                <td>{s.step}</td>
                <td>
                  <span className={`action-badge ${s.action_label === 'hold' ? 'hold' : s.action_label.startsWith('-') ? 'down' : 'up'}`}>
                    {s.action_label}
                  </span>
                </td>
                <td>{s.price.toFixed(2)}</td>
                <td>{s.demand.toFixed(1)}</td>
                <td>{s.units_sold}</td>
                <td>{s.inventory}</td>
                <td>{s.revenue.toFixed(2)}</td>
                <td>{s.cumulative_revenue.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {steps.length > 15 && (
        <button className="btn ghost small" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show less' : `Show all ${steps.length} steps`}
        </button>
      )}
    </section>
  )
}
