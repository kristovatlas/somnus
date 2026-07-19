/** Weekly red light therapy summary card. */

import type { RedLightWeeklySummary } from "../../types";

interface RedLightSummaryProps {
  summary: RedLightWeeklySummary;
}

export function RedLightSummary({ summary }: RedLightSummaryProps) {
  const remaining = Math.max(0, 3 - summary.session_count);

  return (
    <div
      className="dashboard-card dashboard-card-compact"
      data-testid="red-light-summary"
    >
      <h3 className="dashboard-card-title">Red Light Therapy</h3>
      <div className="red-light-stats">
        <span>
          {summary.session_count} session
          {summary.session_count !== 1 ? "s" : ""}
        </span>
        <span>
          {summary.days_with_sessions} day
          {summary.days_with_sessions !== 1 ? "s" : ""}
        </span>
        {summary.total_dose_joules_cm2 > 0 && (
          <span>{summary.total_dose_joules_cm2.toFixed(1)} J/cm²</span>
        )}
      </div>
      <div
        className="red-light-badge"
        style={{
          color: summary.meets_minimum
            ? "var(--color-success)"
            : "var(--color-warning)",
        }}
      >
        {summary.meets_minimum
          ? "On track"
          : `${remaining} more session${remaining !== 1 ? "s" : ""} recommended`}
      </div>
    </div>
  );
}
