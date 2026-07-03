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

export interface TopFactor {
  label: string;
  pearson_r: number;
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
  top_positive_factor: TopFactor | null;
  top_negative_factor: TopFactor | null;
  has_insufficient_data: boolean;
}

export interface NightSummary {
  date: string;
  sleep_score: number;
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
