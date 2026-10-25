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
 *  Feedback endpoint (POST localhost:8000/api/feedback):
 *    Sends actual purchase outcomes back to the model for online
 *    learning.  The agent trains on real interactions, not just
 *    simulation data.
 *
 *  Training stats endpoint (GET localhost:8000/api/training-stats):
 *    Returns the current training state (epsilon, buffer size,
 *    loss, total feedback received).
 */

const PREDICT_URL = import.meta.env.VITE_DQN_PREDICT_URL
const FEEDBACK_URL = import.meta.env.VITE_DQN_FEEDBACK_URL
const STATS_URL = import.meta.env.VITE_DQN_STATS_URL

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
 * Send purchase outcome feedback to the model for online training.
 *
 * This is the critical "closing the loop" call: after a customer
 * checks out, we tell the model what actually happened (how many
 * units sold at what price, remaining inventory, etc.) so it can
 * learn from real-world data.
 *
 * @param {Object} params
 * @param {Object} params.product - The product row from the DB
 * @param {number} params.oldPrice - Price before the model's suggestion
 * @param {number} params.newPrice - Price that was actually applied
 * @param {boolean} params.applied - Whether the suggestion was used
 * @param {number} params.unitsSold - Actual units sold in this transaction
 * @returns {Promise<Object|null>} Training feedback response or null
 */
export async function confirmPriceApplied({ product, oldPrice, newPrice, applied, unitsSold = 0 }) {
  if (!FEEDBACK_URL) return null

  const res = await fetch(FEEDBACK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_id: product.id,
      old_price: oldPrice,
      new_price: newPrice,
      applied,
      units_sold: unitsSold,
      remaining_inventory: product.inventory_count - unitsSold,
      historical_demand: product.historical_demand ?? 0,
      current_demand: product.current_demand ?? 0,
      seasonality: product.seasonality_factor ?? 1.0,
      price_elasticity: product.price_elasticity ?? 0,
      demand_velocity: product.demand_velocity ?? 0
    })
  })

  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.warn('Feedback route failed:', res.status)
    return null
  }

  return res.json()
}

/**
 * Fetch the current online training statistics from the model server.
 *
 * @returns {Promise<Object|null>} Training stats or null if unavailable
 */
export async function getTrainingStats() {
  if (!STATS_URL) return null

  try {
    const res = await fetch(STATS_URL)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}
