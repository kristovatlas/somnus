/** Bedtime consistency visualization — dot plot + stat pills. */

import type { ConsistencyMetrics } from "../../types";

interface ConsistencyMeterProps {
  consistency: ConsistencyMetrics | null;
  typicalBedtime: string | null;
}

const WIDTH = 400;
const HEIGHT = 80;
const PAD = { left: 40, right: 20, top: 10, bottom: 20 };
const CHART_W = WIDTH - PAD.left - PAD.right;
const CHART_H = HEIGHT - PAD.top - PAD.bottom;

// Variability, bedtime offset and weekend drift are all absolute magnitudes
// on the backend (means of |…|), so every explanation must stay
// direction-neutral.
const SIGMA_HELP =
  "How much your bedtime varies night to night over the last 7 nights. Under 30 min is consistent.";
const DELTA_HELP =
  "Average distance between your nightly bedtime and your target bedtime, in either direction. Under 30 min is on target.";
const DRIFT_HELP =
  "How far weekend bedtimes shift from weekday bedtimes, in either direction (social jet lag). Over 60 min is significant.";

function ratingColor(rating: string): string {
  const good = ["consistent", "on_target", "minimal"];
  const mid = ["somewhat_inconsistent", "drifting", "moderate"];
  if (good.includes(rating)) return "var(--color-success)";
  if (mid.includes(rating)) return "var(--color-warning)";
  return "var(--color-error)";
}

export function ConsistencyMeter({
  consistency,
  typicalBedtime,
}: ConsistencyMeterProps) {
  if (!consistency) {
    return (
      <div className="dashboard-card" data-testid="consistency-meter">
        <h3 className="dashboard-card-title">Bedtime Consistency</h3>
        <p className="dashboard-empty">Need more data for consistency.</p>
      </div>
    );
  }

  const dots = consistency.bedtime_dots;
  const hours = dots.map((d) => d.bedtime_hour);
  const minH = Math.floor(Math.min(...hours) - 0.5);
  const maxH = Math.ceil(Math.max(...hours) + 0.5);
  const range = maxH - minH || 1;

  const x = (i: number) =>
    PAD.left + (CHART_W * i) / Math.max(dots.length - 1, 1);
  const y = (h: number) => PAD.top + CHART_H - ((h - minH) / range) * CHART_H;

  // Target bedtime band
  let typicalHour: number | null = null;
  if (typicalBedtime) {
    const [hh, mm] = typicalBedtime.split(":").map(Number);
    typicalHour = hh + mm / 60;
    if (typicalHour < 6) typicalHour += 24;
  }

  const formatHour = (h: number): string => {
    const normalized = h >= 24 ? h - 24 : h;
    const hh = Math.floor(normalized);
    const mm = Math.round((normalized - hh) * 60);
    const ampm = hh >= 12 ? "p" : "a";
    const display = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
    return mm === 0
      ? `${display}${ampm}`
      : `${display}:${String(mm).padStart(2, "0")}${ampm}`;
  };

  return (
    <div className="dashboard-card" data-testid="consistency-meter">
      <h3 className="dashboard-card-title">Bedtime Consistency</h3>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="consistency-svg">
        {/* Y-axis labels */}
        <text
          x={PAD.left - 4}
          y={PAD.top + 4}
          textAnchor="end"
          fill="var(--color-text-muted)"
          fontSize="9"
        >
          {formatHour(maxH)}
        </text>
        <text
          x={PAD.left - 4}
          y={HEIGHT - PAD.bottom + 4}
          textAnchor="end"
          fill="var(--color-text-muted)"
          fontSize="9"
        >
          {formatHour(minH)}
        </text>

        {/* Target bedtime line */}
        {typicalHour != null && (
          <line
            x1={PAD.left}
            y1={y(typicalHour)}
            x2={WIDTH - PAD.right}
            y2={y(typicalHour)}
            stroke="var(--color-chart-1)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        )}

        {/* Bedtime dots */}
        {dots.map((d, i) => (
          <circle
            key={d.date}
            cx={x(i)}
            cy={y(d.bedtime_hour)}
            r="4"
            fill={
              d.is_weekend ? "var(--color-chart-3)" : "var(--color-chart-1)"
            }
          />
        ))}
      </svg>

      <div className="consistency-pills">
        <span
          className="consistency-pill"
          style={{ color: ratingColor(consistency.sigma_rating) }}
        >
          Variability {Math.round(consistency.sigma_minutes)}m
        </span>
        {consistency.delta_minutes != null && consistency.delta_rating && (
          <span
            className="consistency-pill"
            style={{ color: ratingColor(consistency.delta_rating) }}
          >
            Bedtime offset {Math.round(consistency.delta_minutes)}m
          </span>
        )}
        {consistency.weekend_drift_minutes != null &&
          consistency.drift_rating && (
            <span
              className="consistency-pill"
              style={{ color: ratingColor(consistency.drift_rating) }}
            >
              Weekend drift {Math.round(consistency.weekend_drift_minutes)}m
            </span>
          )}
      </div>
      <details className="consistency-details">
        <summary className="consistency-legend">What do these mean?</summary>
        <dl className="consistency-glossary">
          <dt>Variability</dt>
          <dd>{SIGMA_HELP}</dd>
          <dt>Bedtime offset</dt>
          <dd>{DELTA_HELP}</dd>
          <dt>Weekend drift</dt>
          <dd>{DRIFT_HELP}</dd>
        </dl>
      </details>
    </div>
  );
}
