/** TypeScript interfaces for reports. */

import type { ConsistencyMetrics } from "./dashboard";
import type { ExperimentOut } from "./recommendations";

export interface MetricAverages {
  avg_sleep_score: number | null;
  avg_hrv: number | null;
  avg_deep_minutes: number | null;
  avg_rem_minutes: number | null;
}

export interface TrendArrows {
  sleep_score: string | null; // "up" | "down" | "flat"
  avg_hrv: string | null;
  deep_minutes: string | null;
  rem_minutes: string | null;
}

import type { EffectSize } from "./analysis";

export interface TopFactor {
  label: string;
  pearson_r: number;
  n_days: number;
  effect: EffectSize | null;
}

export interface WeeklyReport {
  period_start: string;
  period_end: string;
  iso_year: number;
  iso_week: number;
  days_with_data: number;
  days_in_period: number;
  logging_completeness: string;
  current: MetricAverages;
  prior: MetricAverages;
  trends: TrendArrows;
  consistency: ConsistencyMetrics | null;
  top_positive_factors: TopFactor[];
  top_negative_factors: TopFactor[];
  factors_total_days: number | null;
  has_insufficient_data: boolean;
}

export interface NightSummary {
  date: string;
  sleep_score: number;
  /** #113 context fields — formatted backend-side; optional/nullable
   * (NULL = not recorded). weekday e.g. "Tuesday", bedtime e.g. "11:42 PM". */
  weekday?: string | null;
  bedtime?: string | null;
  total_sleep_minutes?: number | null;
  deep_minutes?: number | null;
  rem_minutes?: number | null;
  avg_hrv?: number | null;
  contributing_factors: string[];
}

export interface StageComplianceReport {
  deep_target_nights: number;
  deep_total_nights: number;
  rem_target_nights: number;
  rem_total_nights: number;
}

export interface MonthlyReport {
  period_start: string;
  period_end: string;
  year: number;
  month: number;
  month_name: string;
  days_with_data: number;
  days_in_period: number;
  logging_completeness: string;
  current: MetricAverages;
  prior: MetricAverages;
  trends: TrendArrows;
  best_night: NightSummary | null;
  worst_night: NightSummary | null;
  stage_compliance: StageComplianceReport | null;
  active_experiment: ExperimentOut | null;
  weekly_summaries: WeeklyReport[];
  has_insufficient_data: boolean;
}
