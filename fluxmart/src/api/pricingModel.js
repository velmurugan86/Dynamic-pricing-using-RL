/**
 * Integration layer for the DQN dynamic-pricing model.
 *
 * Predict endpoint (POST localhost:8000/api/predict):
 *
 *  Request body:
 *    {
 *      "current_price": number,
 *      "remaining_inventory": number,
 *      "historical_demand": number,
 *      "current_demand": number,
 *      "seasonality": number,
 *      "price_elasticity": number,
 *      "demand_velocity": number
 *    }
 *
 *  Response body:
 *    {
 *      "action": number,
 *      "action_label": string,        // e.g. "+10%"
 *      "price_change_percent": number,
 *      "previous_price": number,
 *      "updated_price": number,       // ← the new price to apply
 *      "q_values": { [label]: number },
 *      "normalized_state": number[]
 *    }
 *
 *  Feedback endpoint (optional, POST via VITE_DQN_FEEDBACK_URL):
 *    Notifies the model of the applied outcome for logging / online training.
 *    If the env var is unset, confirmPriceApplied() is a no-op.
 */

const PREDICT_URL = import.meta.env.VITE_DQN_PREDICT_URL
const FEEDBACK_URL = import.meta.env.VITE_DQN_FEEDBACK_URL

/**
 * Ask the DQN model for a new price for a single product.
 *
 * @param {Object} product - a row from the `products` table, with its
 *   latest `demand_metrics` values merged in.
 * @returns {Promise<{ new_price: number, raw: Object }>}
 */
export async function getRepricingSuggestion(product) {
  const payload = {
    current_price: product.current_price,
    remaining_inventory: product.inventory_count,
    historical_demand: product.historical_demand,
    current_demand: product.current_demand,
    seasonality: product.seasonality_factor,
    price_elasticity: product.price_elasticity,
    demand_velocity: product.demand_velocity
  }

  const res = await fetch(PREDICT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  if (!res.ok) {
    throw new Error(`Pricing model request failed (${res.status})`)
  }

  const data = await res.json()

  // The model returns updated_price as the authoritative new price.
  const newPrice = Number(data.updated_price)

  if (Number.isNaN(newPrice)) {
    throw new Error('Pricing model response did not include a usable price (updated_price).')
  }

  return { new_price: newPrice, raw: data }
}

/**
 * Tell the model what actually happened after we applied (or rejected)
 * its suggestion. Optional second route — no-ops if not configured.
 */
export async function confirmPriceApplied({ product, oldPrice, newPrice, applied }) {
  if (!FEEDBACK_URL) return null

  const res = await fetch(FEEDBACK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_id: product.id,
      old_price: oldPrice,
      new_price: newPrice,
      applied
    })
  })

  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.warn('Feedback route failed:', res.status)
    return null
  }

  return res.json()
}
