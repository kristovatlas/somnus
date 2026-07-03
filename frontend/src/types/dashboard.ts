/** TypeScript interfaces mirroring backend dashboard schemas. */

import type { CaffeineEntryOut } from "./dailyLog";
import type { CaffeineSensitivity } from "./enums";
import type { TopRecommendation } from "./recommendations";

export interface SleepRecordOut {
  date: string;
  total_sleep_minutes: number | null;
  rem_minutes: number | null;
  deep_minutes: number | null;
  light_minutes: number | null;
  rem_pct: number | null;
  deep_pct: number | null;
  light_pct: number | null;
  sleep_efficiency: number | null;
  onset_latency_minutes: number | null;
  avg_hrv: number | null;
  lowest_hr: number | null;
  avg_hr: number | null;
  avg_breath_rate: number | null;
  readiness_score: number | null;
  sleep_score: number | null;
  bedtime: string | null;
  wake_time: string | null;
}

export interface StageTargets {
  age_group: string;
  deep_min_minutes: number;
  deep_max_minutes: number;
  rem_min_minutes: number;
  rem_max_minutes: number;
}

export interface TrendDay {
  date: string;
  sleep_score: number | null;
  avg_hrv: number | null;
  deep_minutes: number | null;
  rem_minutes: number | null;
}

export interface StageAverages {
  avg_deep_minutes: number;
  avg_rem_minutes: number;
  avg_light_minutes: number;
  avg_total_minutes: number;
  deep_vs_target: string;
  rem_vs_target: string;
  days_counted: number;
}

export interface BedtimeDot {
  date: string;
  bedtime_hour: number;
  is_weekend: boolean;
}

export interface ConsistencyMetrics {
  sigma_minutes: number;
  sigma_rating: string;
  delta_minutes: number | null;
  delta_rating: string | null;
  weekend_drift_minutes: number | null;
  drift_rating: string | null;
  bedtime_dots: BedtimeDot[];
  days_counted: number;
}

export interface RedLightWeeklySummary {
  session_count: number;
  total_dose_joules_cm2: number;
  days_with_sessions: number;
  meets_minimum: boolean;
}

export interface DashboardData {
  sleep_record: SleepRecordOut | null;
  stage_targets: StageTargets | null;
  trends: TrendDay[];
  stage_averages: StageAverages | null;
  consistency: ConsistencyMetrics | null;
  logging_streak: number;
  red_light_summary: RedLightWeeklySummary;
  today_caffeine_entries: CaffeineEntryOut[];
  caffeine_sensitivity: CaffeineSensitivity;
  typical_bedtime: string | null;
  top_recommendations: TopRecommendation[];
}
