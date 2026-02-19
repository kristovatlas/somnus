/** TypeScript interfaces for recommendations and experiments. */

export interface Recommendation {
  id: string
  category: string
  priority: number
  title: string
  body: string
  factor: string
  factor_label: string
  outcome: string | null
  outcome_label: string | null
  evidence_level: string | null
  suggested_experiment: string | null
  n_days: number | null
}

export interface ExperimentOut {
  id: number
  factor: string
  factor_label: string
  hypothesis: string
  start_date: string
  end_date: string
  status: string
  notes: string | null
  baseline_sleep_score: number | null
  baseline_deep_minutes: number | null
  baseline_rem_minutes: number | null
  baseline_hrv: number | null
  result_sleep_score: number | null
  result_deep_minutes: number | null
  result_rem_minutes: number | null
  result_hrv: number | null
  days_completed: number
}

export interface RecommendationsResponse {
  recommendations: Recommendation[]
  total_days: number
  has_sufficient_data: boolean
  active_experiment: ExperimentOut | null
}

export interface ExperimentCreate {
  factor: string
  hypothesis: string
  start_date: string
  end_date?: string
  notes?: string
}

export interface ExperimentUpdate {
  status?: string
  notes?: string
}

export interface TopRecommendation {
  id: string
  title: string
  category: string
}
