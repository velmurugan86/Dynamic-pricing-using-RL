import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { StepRecord } from '../types'

export default function InventoryChart({
  steps,
  initialInventory,
}: {
  steps: StepRecord[]
  initialInventory: number
}) {
  return (
    <section className="chart-card">
      <h3>Inventory remaining</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={steps} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
          <defs>
            <linearGradient id="invFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" />
          <XAxis dataKey="step" stroke="#8b93a7" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, initialInventory]} stroke="#8b93a7" tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{ background: '#161a22', border: '1px solid #2a2f3a', borderRadius: 8 }}
            labelStyle={{ color: '#e8ebf2' }}
          />
          <Area
            type="stepAfter"
            dataKey="inventory"
            name="Inventory"
            stroke="#a78bfa"
            fill="url(#invFill)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </section>
  )
}
