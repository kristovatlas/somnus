/** 2x2 grid of trend sparklines for key sleep metrics. */

import type { TrendDay } from "../../types";
import { Sparkline } from "./Sparkline";

interface TrendSparklinesProps {
  trends: TrendDay[];
}

function SparkCell({
  label,
  points,
  color,
  srLabel,
  unit,
}: {
  label: string;
  points: (number | null)[];
  color: string;
  srLabel: string;
  unit: string;
}) {
  const values = points.filter((v): v is number => v != null);
  // "Latest" must reflect the actual most recent day: when its value is
  // missing, show the placeholder rather than an older reading
  // masquerading as current
  const latest = points.length > 0 ? points[points.length - 1] : null;
  const min = values.length > 0 ? Math.min(...values) : null;
  const max = values.length > 0 ? Math.max(...values) : null;

  return (
    <div className="sparkline-cell">
      <span className="sparkline-label">
        {label}
        <span className="sparkline-value">
          {latest != null ? `${Math.round(latest)}${unit}` : "—"}
        </span>
      </span>
      <Sparkline points={points} color={color} label={srLabel} />
      {min != null && max != null && (
        <span className="sparkline-range">
          7d range: {Math.round(min)}–{Math.round(max)}
          {unit}
        </span>
      )}
    </div>
  );
}

export function TrendSparklines({ trends }: TrendSparklinesProps) {
  if (trends.length === 0) {
    return (
      <div className="dashboard-card" data-testid="trend-sparklines">
        <h3 className="dashboard-card-title">7-Day Trends</h3>
        <p className="dashboard-empty">No trend data yet.</p>
      </div>
    );
  }

  return (
    <div className="dashboard-card" data-testid="trend-sparklines">
      <h3 className="dashboard-card-title">7-Day Trends</h3>
      <div className="sparkline-grid">
        <SparkCell
          label="Score"
          points={trends.map((t) => t.sleep_score)}
          color="var(--color-chart-1)"
          srLabel="Sleep score trend"
          unit=""
        />
        <SparkCell
          label="HRV"
          points={trends.map((t) => t.avg_hrv)}
          color="var(--color-chart-3)"
          srLabel="HRV trend"
          unit="ms"
        />
        <SparkCell
          label="Deep"
          points={trends.map((t) => t.deep_minutes)}
          color="var(--color-chart-2)"
          srLabel="Deep sleep trend"
          unit="m"
        />
        <SparkCell
          label="REM"
          points={trends.map((t) => t.rem_minutes)}
          color="var(--color-chart-4)"
          srLabel="REM sleep trend"
          unit="m"
        />
      </div>
    </div>
  );
}
