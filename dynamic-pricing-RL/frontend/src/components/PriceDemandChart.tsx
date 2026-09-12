import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { StepRecord } from '../types'

interface Props {
  steps: StepRecord[]
  minPrice: number
  maxPrice: number
}

export default function PriceDemandChart({ steps, minPrice, maxPrice }: Props) {
  return (
    <section className="chart-card">
      <h3>Price &amp; demand per step</h3>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={steps} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" />
          <XAxis dataKey="step" stroke="#8b93a7" tick={{ fontSize: 12 }} />
          <YAxis yAxisId="left" stroke="#8b93a7" tick={{ fontSize: 12 }} />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#8b93a7"
            tick={{ fontSize: 12 }}
            domain={[minPrice * 0.9, maxPrice * 1.05]}
          />
          <Tooltip
            contentStyle={{ background: '#161a22', border: '1px solid #2a2f3a', borderRadius: 8 }}
            labelStyle={{ color: '#e8ebf2' }}
          />
          <ReferenceLine
            yAxisId="right"
            y={maxPrice}
            stroke="#f87171"
            strokeDasharray="4 4"
            label={{ value: 'price cap', fill: '#f87171', fontSize: 11, position: 'insideTopRight' }}
          />
          <ReferenceLine
            yAxisId="right"
            y={minPrice}
            stroke="#f87171"
            strokeDasharray="4 4"
            label={{ value: 'price floor', fill: '#f87171', fontSize: 11, position: 'insideBottomRight' }}
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="demand"
            name="Demand"
            fill="#3b82f633"
            stroke="none"
          />
          <Line
            yAxisId="right"
            type="stepAfter"
            dataKey="price"
            name="Price"
            stroke="#f59e0b"
            dot={false}
            strokeWidth={2}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </section>
  )
}
