/** Regression model metadata — R², warnings, diagnostics. */

import type { RegressionResult } from "../../types";

interface RegressionSummaryProps {
  results: RegressionResult[];
}

export function RegressionSummary({ results }: RegressionSummaryProps) {
  if (results.length === 0) {
    return (
      <div className="analysis-card" data-testid="regression-summary">
        <h3 className="analysis-card-title">Regression Models</h3>
        <p className="analysis-empty">
          Not enough data for regression analysis yet (50+ days needed).
        </p>
      </div>
    );
  }

  return (
    <div className="analysis-card" data-testid="regression-summary">
      <h3 className="analysis-card-title">Regression Models</h3>
      <p className="analysis-card-subtitle">
        Standardized coefficients — how each factor is associated with each
        outcome
      </p>
      <div className="regression-model-list">
        {results.map((r) => (
          <div key={r.outcome} className="regression-model-row">
            <span className="regression-model-name">{r.outcome_label}</span>
            <span className="regression-model-stat">
              R² = {r.r_squared.toFixed(3)}
            </span>
            <span className="regression-model-stat">n = {r.n_days}</span>
            {r.has_autocorrelation && (
              <span className="regression-model-warn">
                autocorrelation detected
              </span>
            )}
            {r.multicollinearity_warning && (
              <span className="regression-model-warn">high VIF</span>
            )}
            {!r.is_stationary && (
              <span className="regression-model-warn">
                non-stationary residuals
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
