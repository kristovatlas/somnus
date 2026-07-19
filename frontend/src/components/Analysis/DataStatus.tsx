/** Per-variable day counts and phase unlock indicators. */

import type { AnalysisStatus } from "../../types";

interface DataStatusProps {
  status: AnalysisStatus;
}

function phaseLabel(
  unlocked: boolean,
  name: string,
  requirement: string,
): string {
  return unlocked ? `${name} unlocked` : `${name} — needs ${requirement}`;
}

export function DataStatus({ status }: DataStatusProps) {
  return (
    <div className="analysis-card" data-testid="data-status">
      <h3 className="analysis-card-title">Data Status</h3>
      <p className="analysis-card-subtitle">
        {status.total_sleep_days} sleep day
        {status.total_sleep_days !== 1 ? "s" : ""} recorded
      </p>

      <div className="analysis-phases">
        <span
          className="analysis-phase-pill"
          style={{
            color: status.phase_a_unlocked
              ? "var(--color-success)"
              : "var(--color-text-muted)",
          }}
        >
          {phaseLabel(status.phase_a_unlocked, "Correlations", "14+ days")}
        </span>
        <span
          className="analysis-phase-pill"
          style={{
            color: status.phase_b_unlocked
              ? "var(--color-success)"
              : "var(--color-text-muted)",
          }}
        >
          {phaseLabel(status.phase_b_unlocked, "Regression", "50+ days")}
        </span>
        <span
          className="analysis-phase-pill"
          style={{
            color: status.phase_c_unlocked
              ? "var(--color-success)"
              : "var(--color-text-muted)",
          }}
        >
          {phaseLabel(status.phase_c_unlocked, "Timing", "30+ bedtimes")}
        </span>
      </div>

      {status.variables.length > 0 && (
        <div className="analysis-variable-list">
          {status.variables
            .filter((v) => v.n_days > 0)
            .sort((a, b) => b.n_days - a.n_days)
            .slice(0, 10)
            .map((v) => (
              <div key={v.name} className="analysis-variable-row">
                <span className="analysis-variable-label">{v.label}</span>
                <span className="analysis-variable-count">{v.n_days}d</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
