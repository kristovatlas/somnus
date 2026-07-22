/** Top positive/negative factors with hedged language (#102: computed
 * across ALL data — the caption says so, since per-week correlations at
 * n≤7 would be noise; identical values week-to-week are expected). */

import { effectHeadline } from "../../effectFormat";
import type { TopFactor } from "../../types";

interface Props {
  positive: TopFactor[];
  negative: TopFactor[];
  totalDays: number | null;
}

function FactorList({ factors }: { factors: TopFactor[] }) {
  return (
    <>
      {factors.map((f, i) => {
        const phrase = effectHeadline(f.effect);
        return (
          <span key={f.label}>
            {i > 0 && " · "}
            <strong>{f.label}</strong>
            {phrase && <> {phrase}</>}{" "}
            <span className="report-factor-r">
              (r={f.pearson_r.toFixed(2)}, n={f.n_days})
            </span>
          </span>
        );
      })}
    </>
  );
}

export function TopFactorsCard({ positive, negative, totalDays }: Props) {
  if (positive.length === 0 && negative.length === 0) return null;

  return (
    <div className="report-card" data-testid="top-factors">
      <h3 className="report-card-title">Top Factors</h3>
      {positive.length > 0 && (
        <p className="report-factor-line">
          Associated with better sleep score: <FactorList factors={positive} />
        </p>
      )}
      {negative.length > 0 && (
        <p className="report-factor-line">
          Associated with worse sleep score: <FactorList factors={negative} />
        </p>
      )}
      {totalDays != null && (
        <p className="report-factor-caption">
          Computed across all {totalDays} days of your data — not specific to
          this week.
        </p>
      )}
    </div>
  );
}
