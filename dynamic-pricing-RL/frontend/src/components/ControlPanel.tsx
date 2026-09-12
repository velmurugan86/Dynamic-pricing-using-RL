import type { ProductConfig } from '../types'

interface Props {
  product: ProductConfig
  onChange: (p: ProductConfig) => void
  policy: string
  onPolicyChange: (p: string) => void
  policies: string[]
  greedyMargin: number
  onGreedyMarginChange: (v: number) => void
  seed: number | ''
  onSeedChange: (v: number | '') => void
  maxSteps: number
  onMaxStepsChange: (v: number) => void
  seasonalityPeriod: number
}

const PRODUCT_FIELDS: { key: keyof ProductConfig; label: string; step?: number }[] = [
  { key: 'product_id', label: 'Product ID' },
  { key: 'initial_price', label: 'Initial price', step: 0.01 },
  { key: 'initial_inventory', label: 'Initial inventory', step: 1 },
  { key: 'minimum_price', label: 'Minimum price', step: 0.01 },
  { key: 'maximum_price', label: 'Maximum price', step: 0.01 },
  { key: 'base_demand', label: 'Base demand', step: 0.1 },
  { key: 'price_elasticity', label: 'Price elasticity', step: 0.05 },
  { key: 'seasonality_strength', label: 'Seasonality strength', step: 0.05 },
  { key: 'demand_noise', label: 'Demand noise', step: 0.01 },
]

export default function ControlPanel(props: Props) {
  const {
    product,
    onChange,
    policy,
    onPolicyChange,
    policies,
    greedyMargin,
    onGreedyMarginChange,
    seed,
    onSeedChange,
    maxSteps,
    onMaxStepsChange,
    seasonalityPeriod,
  } = props

  function setField(key: keyof ProductConfig, value: string) {
    if (key === 'product_id') {
      onChange({ ...product, product_id: value })
      return
    }
    const num = Number(value)
    if (Number.isNaN(num)) return
    onChange({ ...product, [key]: num })
  }

  return (
    <div className="panel">
      <h2>Episode setup</h2>

      <label className="field">
        <span>Policy</span>
        <select value={policy} onChange={(e) => onPolicyChange(e.target.value)}>
          {policies.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>

      {policy === 'greedy' && (
        <label className="field">
          <span>Greedy margin (fraction above initial price)</span>
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={greedyMargin}
            onChange={(e) => onGreedyMarginChange(Number(e.target.value))}
          />
        </label>
      )}

      <label className="field">
        <span>Seed (blank = random each run)</span>
        <input
          type="number"
          value={seed}
          onChange={(e) => onSeedChange(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="random"
        />
      </label>

      <label className="field">
        <span>Max steps</span>
        <input
          type="number"
          min={1}
          value={maxSteps}
          onChange={(e) => onMaxStepsChange(Math.max(1, Number(e.target.value) || 1))}
        />
      </label>

      <p className="hint">Seasonality period: {seasonalityPeriod} steps (from config)</p>

      <h3>Product parameters</h3>
      {PRODUCT_FIELDS.map(({ key, label, step }) => (
        <label className="field" key={key}>
          <span>{label}</span>
          <input
            type={key === 'product_id' ? 'text' : 'number'}
            step={step}
            value={product[key] as string | number}
            onChange={(e) => setField(key, e.target.value)}
          />
        </label>
      ))}
    </div>
  )
}
