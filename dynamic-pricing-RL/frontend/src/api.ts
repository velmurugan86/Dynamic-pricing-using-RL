import type { AppConfig, SimulateRequest, SimulateResponse } from './types'

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      if (body.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
    }
    throw new Error(`API error ${res.status}: ${detail}`)
  }
  return res.json() as Promise<T>
}

export async function fetchConfig(): Promise<AppConfig> {
  return handle<AppConfig>(await fetch('/api/config'))
}

export async function runSimulation(req: SimulateRequest): Promise<SimulateResponse> {
  return handle<SimulateResponse>(
    await fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    }),
  )
}
