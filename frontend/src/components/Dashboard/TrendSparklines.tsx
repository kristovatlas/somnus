/** 2x2 grid of trend sparklines for key sleep metrics. */

import type { TrendDay } from "../../types";
import { Sparkline } from "./Sparkline";

interface TrendSparklinesProps {
  trends: TrendDay[];
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

  const scores = trends.map((t) => t.sleep_score);
  const hrvs = trends.map((t) => t.avg_hrv);
  const deeps = trends.map((t) => t.deep_minutes);
  const rems = trends.map((t) => t.rem_minutes);

  return (
    <div className="dashboard-card" data-testid="trend-sparklines">
      <h3 className="dashboard-card-title">7-Day Trends</h3>
      <div className="sparkline-grid">
        <div className="sparkline-cell">
          <span className="sparkline-label">Score</span>
          <Sparkline
            points={scores}
            color="var(--color-chart-1)"
            label="Sleep score trend"
          />
        </div>
        <div className="sparkline-cell">
          <span className="sparkline-label">HRV</span>
          <Sparkline
            points={hrvs}
            color="var(--color-chart-3)"
            label="HRV trend"
          />
        </div>
        <div className="sparkline-cell">
          <span className="sparkline-label">Deep</span>
          <Sparkline
            points={deeps}
            color="var(--color-chart-2)"
            label="Deep sleep trend"
          />
        </div>
        <div className="sparkline-cell">
          <span className="sparkline-label">REM</span>
          <Sparkline
            points={rems}
            color="var(--color-chart-4)"
            label="REM sleep trend"
          />
        </div>
      </div>
    </div>
  );
}
