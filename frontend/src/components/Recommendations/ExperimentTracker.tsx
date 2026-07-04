/** Active experiment tracker with progress bar and metric comparisons. */

import type { ExperimentOut } from "../../types";

interface Props {
  experiment: ExperimentOut;
  onComplete: () => void;
  onAbandon: () => void;
}

function MetricPill({
  label,
  baseline,
  result,
}: {
  label: string;
  baseline: number | null;
  result: number | null;
}) {
  if (baseline === null && result === null) return null;
  return (
    <span className="experiment-metric">
      <span className="experiment-metric-label">{label}</span>
      <span className="experiment-metric-values">
        {baseline !== null ? baseline.toFixed(0) : "—"}
        {" → "}
        {result !== null ? result.toFixed(0) : "—"}
      </span>
    </span>
  );
}

export function ExperimentTracker({
  experiment,
  onComplete,
  onAbandon,
}: Props) {
  const totalDays = Math.max(
    1,
    Math.round(
      (new Date(experiment.end_date).getTime() -
        new Date(experiment.start_date).getTime()) /
        (1000 * 60 * 60 * 24),
    ) + 1,
  );
  const progressPct = Math.min(
    100,
    Math.round((experiment.days_completed / totalDays) * 100),
  );

  return (
    <div className="experiment-tracker" data-testid="experiment-tracker">
      <h3 className="experiment-title">Active Experiment</h3>
      <p className="experiment-hypothesis">{experiment.hypothesis}</p>
      <p className="experiment-factor">{experiment.factor_label}</p>

      <div className="experiment-progress">
        <div className="experiment-progress-bar">
          <div
            className="experiment-progress-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="experiment-progress-label">
          {experiment.days_completed} / {totalDays} days
        </span>
      </div>

      <div className="experiment-metrics">
        <MetricPill
          label="Score"
          baseline={experiment.baseline_sleep_score}
          result={experiment.result_sleep_score}
        />
        <MetricPill
          label="Deep"
          baseline={experiment.baseline_deep_minutes}
          result={experiment.result_deep_minutes}
        />
        <MetricPill
          label="REM"
          baseline={experiment.baseline_rem_minutes}
          result={experiment.result_rem_minutes}
        />
        <MetricPill
          label="HRV"
          baseline={experiment.baseline_hrv}
          result={experiment.result_hrv}
        />
      </div>

      {experiment.status === "active" && (
        <div className="experiment-actions">
          <button
            className="experiment-btn experiment-btn-complete"
            onClick={onComplete}
          >
            Complete
          </button>
          <button
            className="experiment-btn experiment-btn-abandon"
            onClick={onAbandon}
          >
            Abandon
          </button>
        </div>
      )}
    </div>
  );
}
