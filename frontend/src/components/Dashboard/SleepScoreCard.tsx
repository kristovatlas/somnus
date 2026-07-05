/** Sleep score ring + key metrics card. */

import type { SleepRecordOut } from "../../types";
import { formatDate, isToday } from "../../utils/date";

interface SleepScoreCardProps {
  record: SleepRecordOut | null;
}

/** Oura's `date` is the day the sleep ended, so date === today means last night. */
function nightLabel(dateStr: string): string {
  const formatted = formatDate(dateStr, { month: "short", day: "numeric" });
  return isToday(dateStr)
    ? `Last night (${formatted})`
    : `Night ending ${formatted}`;
}

function MetricPill({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null;
  unit: string;
}) {
  return (
    <span className="dashboard-metric-pill">
      <span className="dashboard-metric-label">{label}</span>
      <span className="dashboard-metric-value">
        {value != null ? `${Math.round(value)}${unit}` : "—"}
      </span>
    </span>
  );
}

export function SleepScoreCard({ record }: SleepScoreCardProps) {
  if (!record) {
    return (
      <div className="dashboard-card" data-testid="sleep-score-card">
        <h3 className="dashboard-card-title">Sleep Score</h3>
        <p className="dashboard-empty">No sleep data — sync your Oura Ring.</p>
      </div>
    );
  }

  const score = record.sleep_score;
  const size = 100;
  const strokeW = 8;
  const r = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  const pct = score != null ? score / 100 : 0;
  const dashoffset = circ * (1 - pct);

  const metrics = [
    { label: "HRV", value: record.avg_hrv, unit: "ms" },
    { label: "Low HR", value: record.lowest_hr, unit: "" },
    {
      label: "Eff",
      value:
        record.sleep_efficiency != null ? record.sleep_efficiency * 100 : null,
      unit: "%",
    },
    { label: "Ready", value: record.readiness_score, unit: "" },
  ];
  const anyMetricMissing = metrics.some((m) => m.value == null);

  return (
    <div className="dashboard-card" data-testid="sleep-score-card">
      <h3 className="dashboard-card-title">Sleep Score</h3>
      <p className="dashboard-card-subtitle">{nightLabel(record.date)}</p>
      <div className="sleep-score-ring-wrapper">
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={strokeW}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--color-chart-1)"
            strokeWidth={strokeW}
            strokeDasharray={circ}
            strokeDashoffset={dashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
          <text
            x={size / 2}
            y={size / 2 + 8}
            textAnchor="middle"
            fill="var(--color-text-primary)"
            fontSize="24"
            fontWeight="bold"
          >
            {score ?? "—"}
          </text>
        </svg>
      </div>
      <div className="dashboard-metric-row">
        {metrics.map((m) => (
          <MetricPill
            key={m.label}
            label={m.label}
            value={m.value}
            unit={m.unit}
          />
        ))}
      </div>
      {anyMetricMissing && (
        <p className="dashboard-missing-note">
          — means Oura didn't return that metric for this night. A re-sync in
          Settings may fill it in.
        </p>
      )}
    </div>
  );
}
