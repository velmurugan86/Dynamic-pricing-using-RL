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

export default function RevenueChart({ steps }: { steps: StepRecord[] }) {
  return (
    <section className="chart-card">
      <h3>Revenue</h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={steps} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
          <defs>
            <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" />
          <XAxis dataKey="step" stroke="#8b93a7" tick={{ fontSize: 12 }} />
          <YAxis stroke="#8b93a7" tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{ background: '#161a22', border: '1px solid #2a2f3a', borderRadius: 8 }}
            labelStyle={{ color: '#e8ebf2' }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            name="Revenue (step)"
            stroke="#34d399"
            fill="url(#revFill)"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="cumulative_revenue"
            name="Cumulative revenue"
            stroke="#60a5fa"
            fill="none"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </section>
  )
}
