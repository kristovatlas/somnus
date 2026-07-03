/** TypeScript interfaces mirroring backend analysis schemas. */

// --- Status ---

export interface VariableStatus {
  name: string;
  label: string;
  n_days: number;
  has_correlations: boolean;
  has_regression: boolean;
}

export interface AnalysisStatus {
  total_sleep_days: number;
  phase_a_unlocked: boolean;
  phase_b_unlocked: boolean;
  phase_c_unlocked: boolean;
  variables: VariableStatus[];
}

// --- Correlations ---

export interface CorrelationResult {
  predictor: string;
  predictor_label: string;
  outcome: string;
  outcome_label: string;
  pearson_r: number;
  spearman_r: number;
  p_value: number;
  n_days: number;
  confidence: "low" | "moderate" | "high";
}

export interface CorrelationResponse {
  results: CorrelationResult[];
  total_days: number;
  excluded_sick_days: number;
}

// --- Regression ---

export interface RegressionCoefficient {
  predictor: string;
  predictor_label: string;
  coefficient: number;
  ci_lower: number | null;
  ci_upper: number | null;
  p_value: number;
  is_significant: boolean;
  vif: number | null;
}

export interface RegressionResult {
  outcome: string;
  outcome_label: string;
  n_days: number;
  r_squared: number;
  adj_r_squared: number;
  coefficients: RegressionCoefficient[];
  has_autocorrelation: boolean;
  is_stationary: boolean;
  multicollinearity_warning: boolean;
  excluded_predictors: string[];
}

export interface RegressionResponse {
  results: RegressionResult[];
  total_days: number;
}

// --- Timing ---

export interface SleepTimingData {
  chronotype: string | null;
  chronotype_confidence: string | null;
  sleep_midpoint_avg_hour: number | null;
  social_jet_lag_minutes: number | null;
  social_jet_lag_rating: string | null;
  optimal_bedtime_start: number | null;
  optimal_bedtime_end: number | null;
  n_days: number;
}

// --- Naps ---

export interface NapSegment {
  timing_label: string;
  duration_label: string;
  n_days: number;
  avg_onset_latency: number | null;
  avg_efficiency: number | null;
  avg_total_sleep: number | null;
  vs_no_nap_onset: number | null;
}

export interface NapData {
  no_nap_baseline: Record<string, number | null>;
  segments: NapSegment[];
  total_nap_days: number;
  total_no_nap_days: number;
}
