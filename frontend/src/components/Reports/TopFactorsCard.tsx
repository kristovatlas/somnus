/** Shows top positive and negative factors with hedged language. */

import type { TopFactor } from "../../types";

interface Props {
  positive: TopFactor | null;
  negative: TopFactor | null;
}

export function TopFactorsCard({ positive, negative }: Props) {
  if (!positive && !negative) return null;

  return (
    <div className="report-card" data-testid="top-factors">
      <h3 className="report-card-title">Top Factors</h3>
      {positive && (
        <p className="report-factor-line">
          Associated with better sleep score: <strong>{positive.label}</strong>{" "}
          <span className="report-factor-r">
            (r={positive.pearson_r.toFixed(3)})
          </span>
        </p>
      )}
      {negative && (
        <p className="report-factor-line">
          Associated with worse sleep score: <strong>{negative.label}</strong>{" "}
          <span className="report-factor-r">
            (r={negative.pearson_r.toFixed(3)})
          </span>
        </p>
      )}
    </div>
  );
}
