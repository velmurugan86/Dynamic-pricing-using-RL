export interface ProductConfig {
  product_id: string
  initial_price: number
  initial_inventory: number
  minimum_price: number
  maximum_price: number
  base_demand: number
  price_elasticity: number
  seasonality_strength: number
  demand_noise: number
}

export interface AppConfig {
  product: ProductConfig
  environment: {
    max_steps: number
    seasonality_period: number
    seed: number
  }
  policies: string[]
  action_labels: Record<string, string>
}

export interface StepRecord {
  step: number
  action: number
  action_label: string
  price: number
  demand: number
  units_sold: number
  inventory: number
  seasonality: number
  revenue: number
  cumulative_revenue: number
}

export interface EpisodeSummary {
  total_revenue: number
  steps: number
  initial_inventory: number
  final_inventory: number
  terminated: boolean
  truncated: boolean
  average_price: number
  min_price: number
  max_price: number
  total_units_sold: number
}

export interface SimulateResponse {
  policy: string
  seed: number | null
  product: ProductConfig
  summary: EpisodeSummary
  steps: StepRecord[]
}

export interface SimulateRequest {
  product?: Partial<ProductConfig>
  max_steps?: number
  seasonality_period?: number
  seed?: number | null
  policy: string
  greedy_margin?: number
}
