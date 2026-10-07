import React, { useEffect, useMemo, useState } from 'react'
import { useProducts } from '../context/ProductsContext'
import { supabase } from '../lib/supabaseClient'
import { formatINR } from '../lib/formatINR'
import { getRepricingSuggestion } from '../api/pricingModel'

/**
 * Editable form for the DQN model input parameters, one product at a time.
 * inventory_count is READ-ONLY here — it is decremented automatically on
 * each customer purchase (place_order RPC) and can only be changed via the
 * dedicated Override / Add Inventory panels at the bottom of this page.
 */

// Field definitions — inventory_count intentionally excluded (read-only).
const FIELDS = [
  {
    key: 'seasonality_factor',
    label: 'Seasonality factor',
    type: 'number',
    step: 0.001,
    min: 0,
    exclusiveMin: true,
    description: 'e.g. 0.8 off-season .. 1.5 peak (numeric, > 0)'
  },
  {
    key: 'historical_demand',
    label: 'Historical demand',
    type: 'number',
    step: 0.01,
    min: 0,
    description: 'Avg units/period, trailing (numeric, >= 0)'
  },
  {
    key: 'current_demand',
    label: 'Current demand',
    type: 'number',
    step: 0.01,
    min: 0,
    description: 'Units in the current period (numeric, >= 0)'
  },
  {
    key: 'price_elasticity',
    label: 'Price elasticity',
    type: 'number',
    step: 0.001,
    description: '% demand change per % price change (numeric, usually <= 0)'
  },
  {
    key: 'demand_velocity',
    label: 'Demand velocity',
    type: 'number',
    step: 0.001,
    description: 'Rate of change of demand (numeric)'
  }
]

function toInputValue(v) {
  return v === null || v === undefined ? '' : String(v)
}

export default function ModelInputs() {
  const { products, loading: productsLoading, error: productsError, refresh, updateProductPrice } = useProducts()
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState({})
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null)

  // Inventory override panel
  const [showOverride, setShowOverride] = useState(false)
  const [overrideValue, setOverrideValue] = useState('')
  const [overrideBusy, setOverrideBusy] = useState(false)
  const [overrideStatus, setOverrideStatus] = useState(null)

  // Add inventory panel
  const [addUnits, setAddUnits] = useState('')
  const [addBusy, setAddBusy] = useState(false)
  const [addStatus, setAddStatus] = useState(null)

  // Default to the first product once the list loads.
  useEffect(() => {
    if (!selectedId && products.length > 0) {
      setSelectedId(products[0].id)
    }
  }, [products, selectedId])

  // Load the selected product current values into the form.
  useEffect(() => {
    const product = products.find((p) => p.id === selectedId)
    if (!product) return
    setForm(Object.fromEntries(FIELDS.map((f) => [f.key, toInputValue(product[f.key])])))
    setDirty(false)
    setStatus(null)
    setShowOverride(false)
    setOverrideValue('')
    setOverrideStatus(null)
    setAddUnits('')
    setAddStatus(null)
  }, [selectedId, products])

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedId),
    [products, selectedId]
  )

  function handleChange(key, raw) {
    setForm((prev) => ({ ...prev, [key]: raw }))
    setDirty(true)
  }

  function validate() {
    const errors = []
    for (const f of FIELDS) {
      const raw = form[f.key]
      if (raw === '' || raw === null || raw === undefined) {
        if (['seasonality_factor', 'historical_demand', 'current_demand'].includes(f.key)) {
          errors.push(`${f.label} is required.`)
        }
        continue
      }
      const n = Number(raw)
      if (Number.isNaN(n)) {
        errors.push(`${f.label} must be a number.`)
      } else if (f.min !== undefined && n < f.min) {
        errors.push(`${f.label} must be >= ${f.min}.`)
      } else if (f.exclusiveMin && n <= f.min) {
        errors.push(`${f.label} must be > ${f.min}.`)
      }
    }
    return errors
  }

  async function handleSave(e) {
    e.preventDefault()
    const errors = validate()
    if (errors.length > 0) {
      setStatus({ type: 'error', text: errors.join(' ') })
      return
    }
    setBusy(true)
    setStatus(null)
    try {
      // inventory_count is read-only — pass the current DB value unchanged.
      const currentInventory = selectedProduct?.inventory_count ?? 0
      const { error: rpcError } = await supabase.rpc('apply_product_inputs', {
        p_product_id: selectedId,
        p_inventory_count: currentInventory,
        p_seasonality_factor: Number(form.seasonality_factor),
        p_historical_demand: Number(form.historical_demand),
        p_current_demand: Number(form.current_demand),
        p_price_elasticity: form.price_elasticity === '' ? null : Number(form.price_elasticity),
        p_demand_velocity: form.demand_velocity === '' ? null : Number(form.demand_velocity)
      })
      if (rpcError) throw rpcError

      const productForModel = {
        ...selectedProduct,
        inventory_count: currentInventory,
        seasonality_factor: Number(form.seasonality_factor),
        historical_demand: Number(form.historical_demand),
        current_demand: Number(form.current_demand),
        price_elasticity: form.price_elasticity === '' ? 0 : Number(form.price_elasticity),
        demand_velocity: form.demand_velocity === '' ? 0 : Number(form.demand_velocity)
      }

      let modelResult = null
      try {
        const { new_price, raw } = await getRepricingSuggestion(productForModel)
        modelResult = raw

        await supabase.from('model_requests_log').insert({
          product_id: selectedId,
          route: 'predict',
          request_payload: {
            current_price: productForModel.current_price,
            remaining_inventory: productForModel.inventory_count,
            historical_demand: productForModel.historical_demand,
            current_demand: productForModel.current_demand,
            seasonality: productForModel.seasonality_factor,
            price_elasticity: productForModel.price_elasticity,
            demand_velocity: productForModel.demand_velocity
          },
          response_payload: raw
        })

        const { error: priceError } = await supabase.rpc('apply_price_update', {
          p_product_id: selectedId,
          p_new_price: new_price,
          p_source: 'dqn_model'
        })
        if (priceError) throw priceError

        updateProductPrice(selectedId, new_price)
        await refresh()
        setDirty(false)
        setStatus({
          type: 'success',
          text: 'Inputs saved and price updated successfully.',
          modelResult: {
            previousPrice: raw.previous_price,
            updatedPrice: raw.updated_price,
            actionLabel: raw.action_label,
            priceChangePercent: raw.price_change_percent,
            qValues: raw.q_values
          }
        })
      } catch (modelErr) {
        await refresh()
        setDirty(false)
        setStatus({
          type: 'warn',
          text: `Inputs saved to database, but the model call failed: ${modelErr.message}`
        })
      }
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  async function handleOverride(e) {
    e.preventDefault()
    const val = Math.trunc(Number(overrideValue))
    if (Number.isNaN(val) || val < 0) {
      setOverrideStatus({ type: 'error', text: 'Please enter a valid non-negative integer.' })
      return
    }
    setOverrideBusy(true)
    setOverrideStatus(null)
    try {
      const { error } = await supabase.rpc('override_inventory', {
        p_product_id: selectedId,
        p_new_inventory: val
      })
      if (error) throw error
      await refresh()
      setOverrideStatus({ type: 'success', text: `Inventory set to ${val} units.` })
      setOverrideValue('')
      setShowOverride(false)
    } catch (err) {
      setOverrideStatus({ type: 'error', text: err.message })
    } finally {
      setOverrideBusy(false)
    }
  }

  async function handleAddInventory(e) {
    e.preventDefault()
    const val = Math.trunc(Number(addUnits))
    if (Number.isNaN(val) || val <= 0) {
      setAddStatus({ type: 'error', text: 'Please enter a positive integer number of units to add.' })
      return
    }
    setAddBusy(true)
    setAddStatus(null)
    try {
      const { error } = await supabase.rpc('add_inventory', {
        p_product_id: selectedId,
        p_units_added: val
      })
      if (error) throw error
      await refresh()
      setAddStatus({
        type: 'success',
        text: `Added ${val} unit${val === 1 ? '' : 's'}. New stock: ${(selectedProduct?.inventory_count ?? 0) + val} units.`
      })
      setAddUnits('')
    } catch (err) {
      setAddStatus({ type: 'error', text: err.message })
    } finally {
      setAddBusy(false)
    }
  }

  if (productsLoading) {
    return (
      <section className="mx-auto max-w-2xl px-6 py-16">
        <p className="font-medium">Loading products...</p>
      </section>
    )
  }

  if (productsError) {
    return (
      <section className="mx-auto max-w-2xl px-6 py-16">
        <p className="font-medium text-red-600">{productsError}</p>
      </section>
    )
  }

  const inventoryCount = selectedProduct?.inventory_count ?? '-'

  return (
    <section className="mx-auto max-w-2xl px-6 py-16 space-y-8">
      <div>
        <h1 className="font-display text-4xl mb-2">Model inputs</h1>
        <p className="text-brand-ink/70 font-medium">
          Set the input parameters the DQN model uses when repricing each product.
          Saving updates the product row, logs a demand_metrics snapshot,
          and immediately calls the model to apply the new price.
        </p>
      </div>

      {/* Main model inputs form */}
      <form
        onSubmit={handleSave}
        className="border-2 border-brand-ink rounded-2xl bg-white shadow-pop p-6 space-y-5"
      >
        <div>
          <label className="block text-sm font-semibold mb-1" htmlFor="product-select">
            Product
          </label>
          <select
            id="product-select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-lg border-2 border-brand-ink px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {selectedProduct && (
          <div className="flex items-center gap-3 text-sm font-medium text-brand-ink/60">
            <span>
              Current price:{' '}
              <span className="font-bold text-brand-ink">
                {formatINR(selectedProduct.current_price)}
              </span>
            </span>
            <span>·</span>
            <span>Repriced on save.</span>
          </div>
        )}

        {/* Read-only inventory display */}
        <div className="rounded-xl border-2 border-dashed border-brand-ink/30 bg-brand-cream/60 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-brand-ink/50 uppercase tracking-wide mb-0.5">
              Current inventory
            </p>
            <p className="text-2xl font-display text-brand-ink">
              {inventoryCount}
              <span className="text-sm font-medium text-brand-ink/50 ml-1">units</span>
            </p>
            <p className="text-xs text-brand-ink/40 mt-0.5">
              Decremented automatically on each customer purchase. Use the panels below to restock.
            </p>
          </div>
          <span className="text-3xl select-none">📦</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-semibold mb-1" htmlFor={`field-${f.key}`}>
                {f.label}
              </label>
              <input
                id={`field-${f.key}`}
                type="number"
                step={f.step}
                min={f.exclusiveMin ? undefined : f.min}
                value={form[f.key] ?? ''}
                onChange={(e) => handleChange(f.key, e.target.value)}
                className="w-full rounded-lg border-2 border-brand-ink px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-green"
              />
              <p className="mt-1 text-xs text-brand-ink/50">{f.description}</p>
            </div>
          ))}
        </div>

        {status && (
          <div
            className={`rounded-xl border-2 p-4 text-sm font-medium ${
              status.type === 'success'
                ? 'border-green-400 bg-green-50 text-green-800'
                : status.type === 'warn'
                ? 'border-yellow-400 bg-yellow-50 text-yellow-800'
                : 'border-red-400 bg-red-50 text-red-700'
            }`}
          >
            <p className="font-semibold">{status.text}</p>

            {status.modelResult && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-brand-ink/60 line-through">
                    {formatINR(status.modelResult.previousPrice)}
                  </span>
                  <span className="text-2xl font-bold text-green-700">
                    {formatINR(status.modelResult.updatedPrice)}
                  </span>
                  <span className="rounded-full bg-green-200 text-green-800 text-xs font-bold px-3 py-1">
                    {status.modelResult.actionLabel} ({status.modelResult.priceChangePercent > 0 ? '+' : ''}{status.modelResult.priceChangePercent}%)
                  </span>
                </div>

                {status.modelResult.qValues && (
                  <div>
                    <p className="text-xs font-semibold text-brand-ink/50 mb-1 mt-2">Q-values (model confidence)</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(status.modelResult.qValues).map(([label, qv]) => {
                        const isChosen = label === status.modelResult.actionLabel
                        return (
                          <span
                            key={label}
                            className={`rounded-lg px-2 py-1 text-xs font-mono ${
                              isChosen ? 'bg-brand-ink text-white' : 'bg-brand-ink/10 text-brand-ink'
                            }`}
                          >
                            {label}: {Number(qv).toFixed(2)}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-brand-ink text-white font-semibold px-6 py-2.5 hover:bg-black/80 disabled:opacity-50 transition-colors"
          >
            {busy ? 'Saving & running model...' : 'Save & run model'}
          </button>
          {dirty && (
            <button
              type="button"
              onClick={() =>
                selectedProduct &&
                setForm(Object.fromEntries(FIELDS.map((f) => [f.key, toInputValue(selectedProduct[f.key])])))
              }
              className="text-sm font-semibold underline hover:opacity-60 transition-opacity"
            >
              Reset
            </button>
          )}
        </div>
      </form>

      {/* Inventory management panels */}
      <div className="space-y-4">
        <h2 className="font-display text-xl text-brand-ink">Inventory management</h2>
        <p className="text-sm text-brand-ink/60">
          Inventory is automatically decremented when customers place orders.
          Use the tools below to correct or restock inventory for{' '}
          <span className="font-semibold">{selectedProduct?.name ?? 'the selected product'}</span>.
        </p>

        {/* Override Inventory panel */}
        <div className="border-2 border-brand-ink rounded-2xl bg-white shadow-pop overflow-hidden">
          <button
            type="button"
            id="toggle-override-inventory"
            onClick={() => { setShowOverride((v) => !v); setOverrideStatus(null) }}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-brand-cream/40 transition-colors text-left"
          >
            <div>
              <p className="font-semibold text-brand-ink">Override inventory</p>
              <p className="text-xs text-brand-ink/50">Set inventory to an exact number, replacing the current value.</p>
            </div>
            <span className="text-brand-ink/40 text-lg select-none">{showOverride ? 'v' : '>'}</span>
          </button>

          {showOverride && (
            <form
              onSubmit={handleOverride}
              className="border-t-2 border-brand-ink/10 px-6 py-4 space-y-3"
            >
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-semibold mb-1" htmlFor="override-inventory-value">
                    New inventory count
                  </label>
                  <input
                    id="override-inventory-value"
                    type="number"
                    min={0}
                    step={1}
                    value={overrideValue}
                    onChange={(e) => setOverrideValue(e.target.value)}
                    placeholder={`Currently ${inventoryCount}`}
                    className="w-full rounded-lg border-2 border-brand-ink px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-green"
                  />
                  <p className="mt-1 text-xs text-brand-ink/50">
                    Enter the exact total stock that should be on hand (integer >= 0).
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={overrideBusy || overrideValue === ''}
                  id="btn-override-inventory"
                  className="rounded-full bg-brand-ink text-white font-semibold px-5 py-2.5 hover:bg-black/80 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {overrideBusy ? 'Saving...' : 'Set inventory'}
                </button>
              </div>

              {overrideStatus && (
                <p className={`text-sm font-medium ${overrideStatus.type === 'success' ? 'text-green-700' : 'text-red-600'}`}>
                  {overrideStatus.text}
                </p>
              )}
            </form>
          )}
        </div>

        {/* Add Inventory panel */}
        <div className="border-2 border-brand-ink rounded-2xl bg-white shadow-pop p-6 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-brand-ink">Add new inventory</p>
              <p className="text-xs text-brand-ink/50">Record a restock shipment - units are added on top of current stock.</p>
            </div>
            <span className="text-2xl select-none">🚚</span>
          </div>

          <form onSubmit={handleAddInventory} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-sm font-semibold mb-1" htmlFor="add-inventory-units">
                Units to add
              </label>
              <input
                id="add-inventory-units"
                type="number"
                min={1}
                step={1}
                value={addUnits}
                onChange={(e) => setAddUnits(e.target.value)}
                placeholder="e.g. 50"
                className="w-full rounded-lg border-2 border-brand-ink px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-green"
              />
              <p className="mt-1 text-xs text-brand-ink/50">
                Current stock: <span className="font-semibold">{inventoryCount}</span> units.
                After adding: <span className="font-semibold">
                  {addUnits && !Number.isNaN(Number(addUnits)) && Number(addUnits) > 0
                    ? (selectedProduct?.inventory_count ?? 0) + Math.trunc(Number(addUnits))
                    : '-'}
                </span> units.
              </p>
            </div>
            <button
              type="submit"
              disabled={addBusy || addUnits === ''}
              id="btn-add-inventory"
              className="rounded-full bg-brand-green text-brand-ink font-semibold px-5 py-2.5 hover:opacity-80 disabled:opacity-50 transition-opacity whitespace-nowrap border-2 border-brand-ink"
            >
              {addBusy ? 'Adding...' : '+ Add stock'}
            </button>
          </form>

          {addStatus && (
            <p className={`text-sm font-medium ${addStatus.type === 'success' ? 'text-green-700' : 'text-red-600'}`}>
              {addStatus.text}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}