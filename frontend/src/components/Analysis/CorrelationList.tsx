/** Ranked list of correlations sorted by strength. */

import type { CorrelationResult } from "../../types";

interface CorrelationListProps {
  results: CorrelationResult[];
  excludedSickDays: number;
}

function rColor(r: number): string {
  if (r > 0.3) return "var(--color-chart-1)";
  if (r < -0.3) return "var(--color-error)";
  return "var(--color-text-muted)";
}

function confBadge(confidence: string): string {
  if (confidence === "high") return "var(--color-success)";
  if (confidence === "moderate") return "var(--color-warning)";
  return "var(--color-text-muted)";
}

export function CorrelationList({
  results,
  excludedSickDays,
}: CorrelationListProps) {
  if (results.length === 0) {
    return (
      <div className="analysis-card" data-testid="correlation-list">
        <h3 className="analysis-card-title">Correlations</h3>
        <p className="analysis-empty">Not enough data for correlations yet.</p>
      </div>
    );
  }

  // Show top 20 most significant
  const top = results.slice(0, 20);

  return (
    <div className="analysis-card" data-testid="correlation-list">
      <h3 className="analysis-card-title">Correlations</h3>
      {excludedSickDays > 0 && (
        <p className="analysis-card-subtitle">
          {excludedSickDays} sick day{excludedSickDays !== 1 ? "s" : ""}{" "}
          excluded
        </p>
      )}

      <div className="correlation-rows">
        {top.map((r) => (
          <div key={`${r.predictor}-${r.outcome}`} className="correlation-row">
            <div className="correlation-labels">
              <span className="correlation-predictor">{r.predictor_label}</span>
              <span className="correlation-arrow">→</span>
              <span className="correlation-outcome">{r.outcome_label}</span>
            </div>
            <div className="correlation-stats">
              <span
                className="correlation-r"
                style={{ color: rColor(r.pearson_r) }}
              >
                r = {r.pearson_r > 0 ? "+" : ""}
                {r.pearson_r.toFixed(2)}
              </span>
              <span className="correlation-n">n={r.n_days}</span>
              <span
                className="correlation-confidence"
                style={{ color: confBadge(r.confidence) }}
              >
                {r.confidence}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
