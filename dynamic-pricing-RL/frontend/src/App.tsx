import { useEffect, useState } from 'react'
import './App.css'
import { fetchConfig, runSimulation } from './api'
import type { AppConfig, ProductConfig, SimulateResponse } from './types'
import ControlPanel from './components/ControlPanel'
import SummaryCards from './components/SummaryCards'
import PriceDemandChart from './components/PriceDemandChart'
import RevenueChart from './components/RevenueChart'
import InventoryChart from './components/InventoryChart'
import EpisodeTable from './components/EpisodeTable'

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [product, setProduct] = useState<ProductConfig | null>(null)
  const [policy, setPolicy] = useState('random')
  const [greedyMargin, setGreedyMargin] = useState(0.1)
  const [seed, setSeed] = useState<number | ''>('')
  const [maxSteps, setMaxSteps] = useState<number>(100)
  const [result, setResult] = useState<SimulateResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchConfig()
      .then((cfg) => {
        setConfig(cfg)
        setProduct(cfg.product)
        setMaxSteps(cfg.environment.max_steps)
        setSeed(cfg.environment.seed)
      })
      .catch((e) => setError(String(e)))
  }, [])

  async function runEpisode() {
    if (!config) return
    setLoading(true)
    setError(null)
    try {
      const res = await runSimulation({
        product,
        max_steps: maxSteps,
        seed: seed === '' ? null : seed,
        policy,
        greedy_margin: greedyMargin,
      })
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  function resetToDefaults() {
    if (!config) return
    setProduct(config.product)
    setMaxSteps(config.environment.max_steps)
    setSeed(config.environment.seed)
    setPolicy('random')
    setGreedyMargin(0.1)
  }

  const hasChanges =
    config !== null &&
    product !== null &&
    (JSON.stringify(product) !== JSON.stringify(config.product) ||
      maxSteps !== config.environment.max_steps)

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Dynamic Pricing Simulator</h1>
          <p className="subtitle">
            Gymnasium environment · {config?.product.product_id ?? '…'} ·
            actions −10% / −5% / hold / +5% / +10%
          </p>
        </div>
        <div className="header-actions">
          <button className="btn ghost" onClick={resetToDefaults} disabled={!config}>
            Reset defaults
          </button>
          <button className="btn primary" onClick={runEpisode} disabled={loading || !config}>
            {loading ? 'Simulating…' : 'Run episode'}
          </button>
        </div>
      </header>

      {error && (
        <div className="banner error" role="alert">
          {error}
        </div>
      )}

      <div className="layout">
        <aside className="sidebar">
          {config && product && (
            <ControlPanel
              product={product}
              onChange={setProduct}
              policy={policy}
              onPolicyChange={setPolicy}
              policies={config.policies}
              greedyMargin={greedyMargin}
              onGreedyMarginChange={setGreedyMargin}
              seed={seed}
              onSeedChange={setSeed}
              maxSteps={maxSteps}
              onMaxStepsChange={setMaxSteps}
              seasonalityPeriod={config.environment.seasonality_period}
            />
          )}
          {hasChanges && (
            <p className="hint">
              Product settings differ from configs/default.yaml (backend defaults are
              unaffected).
            </p>
          )}
        </aside>

        <main className="content">
          {result ? (
            <>
              <SummaryCards summary={result.summary} policy={result.policy} />
              <PriceDemandChart steps={result.steps} minPrice={result.product.minimum_price} maxPrice={result.product.maximum_price} />
              <RevenueChart steps={result.steps} />
              <InventoryChart steps={result.steps} initialInventory={result.summary.initial_inventory} />
              <EpisodeTable steps={result.steps} />
            </>
          ) : (
            <div className="placeholder">
              <p>
                Configure the product and policy on the left, then run an episode to see
                price, demand, inventory and revenue charts.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
