/** API functions for analysis endpoints. */

import { fetchJson } from './client'
import type {
  AnalysisStatus,
  CorrelationResponse,
  RegressionResponse,
  SleepTimingData,
  NapData,
} from '../types'

export function getAnalysisStatus(): Promise<AnalysisStatus> {
  return fetchJson<AnalysisStatus>('/api/analysis/status')
}

export function getCorrelations(): Promise<CorrelationResponse> {
  return fetchJson<CorrelationResponse>('/api/analysis/correlations')
}

export function getRegression(): Promise<RegressionResponse> {
  return fetchJson<RegressionResponse>('/api/analysis/regression')
}

export function getTiming(): Promise<SleepTimingData> {
  return fetchJson<SleepTimingData>('/api/analysis/timing')
}

export function getNaps(): Promise<NapData> {
  return fetchJson<NapData>('/api/analysis/naps')
}
