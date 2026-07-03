/** Sleep score ring + key metrics card. */

import type { SleepRecordOut } from "../../types";

interface SleepScoreCardProps {
  record: SleepRecordOut | null;
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

  return (
    <div className="dashboard-card" data-testid="sleep-score-card">
      <h3 className="dashboard-card-title">Sleep Score</h3>
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
        <MetricPill label="HRV" value={record.avg_hrv} unit="ms" />
        <MetricPill label="Low HR" value={record.lowest_hr} unit="" />
        <MetricPill
          label="Eff"
          value={
            record.sleep_efficiency != null
              ? record.sleep_efficiency * 100
              : null
          }
          unit="%"
        />
        <MetricPill label="Ready" value={record.readiness_score} unit="" />
      </div>
    </div>
  );
}
