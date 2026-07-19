/** Dashboard — aggregated sleep overview page. */

import { useDashboard } from "../../hooks/useDashboard";
import { useCaffeineDecay } from "../../hooks/useCaffeineDecay";
import { CaffeineChart } from "../CaffeineChart/CaffeineChart";
import { SleepScoreCard } from "./SleepScoreCard";
import { StageBreakdownBar } from "./StageBreakdownBar";
import { TrendSparklines } from "./TrendSparklines";
import { ConsistencyMeter } from "./ConsistencyMeter";
import { BedtimeCountdown } from "./BedtimeCountdown";
import { LoggingStreak } from "./LoggingStreak";
import { RedLightSummary } from "./RedLightSummary";
import { TopRecommendations } from "./TopRecommendations";
import "./DashboardPage.css";

export function DashboardPage() {
  const { data, loading, error } = useDashboard();

  const caffeineEntries = data?.today_caffeine_entries ?? [];
  const sensitivity = data?.caffeine_sensitivity ?? "normal";
  const caffeinePoints = useCaffeineDecay(caffeineEntries, sensitivity);

  const bedtimeHour = data?.typical_bedtime
    ? Number(data.typical_bedtime.split(":")[0]) +
      Number(data.typical_bedtime.split(":")[1]) / 60
    : null;

  if (loading) {
    return <div className="dashboard-empty">Loading dashboard...</div>;
  }

  if (error || !data) {
    return (
      <div className="dashboard-error">
        {error ?? "Failed to load dashboard."}
      </div>
    );
  }

  return (
    <div className="dashboard-grid" data-testid="dashboard-page">
      <SleepScoreCard record={data.sleep_record} />

      <StageBreakdownBar
        record={data.sleep_record}
        averages={data.stage_averages}
        targets={data.stage_targets}
      />

      <div className="dashboard-card dashboard-card-wide">
        <TrendSparklines trends={data.trends} />
      </div>

      <ConsistencyMeter
        consistency={data.consistency}
        typicalBedtime={data.typical_bedtime}
      />

      <BedtimeCountdown typicalBedtime={data.typical_bedtime} />

      <LoggingStreak streak={data.logging_streak} />

      <RedLightSummary summary={data.red_light_summary} />

      <TopRecommendations recommendations={data.top_recommendations ?? []} />

      {caffeineEntries.length > 0 && (
        <div className="dashboard-caffeine">
          <CaffeineChart points={caffeinePoints} bedtimeHour={bedtimeHour} />
        </div>
      )}
    </div>
  );
}
