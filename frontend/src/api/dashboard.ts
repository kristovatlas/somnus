/** Dashboard API — single BFF endpoint. */

import { fetchJson } from './client'
import type { DashboardData } from '../types'

export function getDashboard(): Promise<DashboardData> {
  return fetchJson<DashboardData>('/api/dashboard')
}
