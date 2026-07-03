/** Chronotype, optimal bedtime window, and social jet lag display. */

import type { SleepTimingData } from "../../types";

interface TimingViewProps {
  data: SleepTimingData;
}

const CHRONO_LABELS: Record<string, string> = {
  early: "Early Bird",
  intermediate: "Intermediate",
  late: "Night Owl",
};

function formatHour(h: number): string {
  const normalized = h >= 24 ? h - 24 : h;
  const hh = Math.floor(normalized);
  const mm = Math.round((normalized - hh) * 60);
  const ampm = hh >= 12 ? "PM" : "AM";
  const display = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return mm === 0
    ? `${display} ${ampm}`
    : `${display}:${String(mm).padStart(2, "0")} ${ampm}`;
}

function jetLagColor(rating: string | null): string {
  if (rating === "minimal") return "var(--color-success)";
  if (rating === "moderate") return "var(--color-warning)";
  return "var(--color-error)";
}

export function TimingView({ data }: TimingViewProps) {
  if (!data.chronotype) {
    return (
      <div className="analysis-card" data-testid="timing-view">
        <h3 className="analysis-card-title">Sleep Timing</h3>
        <p className="analysis-empty">
          Need 30+ days with bedtime data to analyze timing patterns.
        </p>
      </div>
    );
  }

  return (
    <div className="analysis-card" data-testid="timing-view">
      <h3 className="analysis-card-title">Sleep Timing</h3>

      <div className="timing-chrono">
        <span className="timing-chrono-label">
          {CHRONO_LABELS[data.chronotype] ?? data.chronotype}
        </span>
        {data.chronotype_confidence && (
          <span className="timing-chrono-confidence">
            ({data.chronotype_confidence} confidence)
          </span>
        )}
      </div>

      {data.sleep_midpoint_avg_hour != null && (
        <p className="timing-stat">
          Average sleep midpoint: {formatHour(data.sleep_midpoint_avg_hour)}
        </p>
      )}

      {data.optimal_bedtime_start != null &&
        data.optimal_bedtime_end != null && (
          <div className="timing-optimal">
            <span className="timing-stat">
              Optimal bedtime window: {formatHour(data.optimal_bedtime_start)}
              {" — "}
              {formatHour(data.optimal_bedtime_end)}
            </span>
            <p className="analysis-card-subtitle">
              Based on bedtimes associated with your top sleep scores
            </p>
          </div>
        )}

      {data.social_jet_lag_minutes != null && data.social_jet_lag_rating && (
        <div className="timing-jetlag">
          <span
            className="timing-jetlag-pill"
            style={{ color: jetLagColor(data.social_jet_lag_rating) }}
          >
            Social jet lag: {Math.round(data.social_jet_lag_minutes)} min (
            {data.social_jet_lag_rating})
          </span>
          <p className="analysis-card-subtitle">
            Difference between weekday and weekend sleep midpoints
          </p>
        </div>
      )}

      <p className="timing-stat analysis-card-subtitle">
        Based on {data.n_days} days of data
      </p>
    </div>
  );
}
