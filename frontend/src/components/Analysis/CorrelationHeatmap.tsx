/** SVG correlation heatmap — predictor rows × outcome columns. */

import type { CorrelationResult } from "../../types";

interface CorrelationHeatmapProps {
  results: CorrelationResult[];
}

const PRIMARY_OUTCOMES = [
  "sleep_score",
  "deep_minutes",
  "rem_minutes",
  "avg_hrv",
];
const OUTCOME_SHORT: Record<string, string> = {
  sleep_score: "Score",
  deep_minutes: "Deep",
  rem_minutes: "REM",
  avg_hrv: "HRV",
};

const CELL = 36;
const PAD = { left: 140, top: 30 };

// #104: round FIRST, then sign — r=-0.04 used to render "-0.0" next to a
// "+0.0" (r=+0.04), a distinction without a difference. `|| 0` folds -0 to 0.
function fmtR(r: number): string {
  const v = Math.round(r * 10) / 10 || 0;
  return (v > 0 ? "+" : "") + v.toFixed(1);
}

function cellColor(r: number): string {
  // Amber (positive) → muted (zero) → red (negative)
  const abs = Math.min(Math.abs(r), 1);
  const alpha = abs * 0.8 + 0.1;
  if (r > 0) return `rgba(255, 140, 0, ${alpha})`;
  if (r < 0) return `rgba(204, 51, 51, ${alpha})`;
  return "var(--color-bg-elevated)";
}

export function CorrelationHeatmap({ results }: CorrelationHeatmapProps) {
  // Build lookup: predictor+outcome → r
  const lookup = new Map<string, number>();
  for (const r of results) {
    lookup.set(`${r.predictor}:${r.outcome}`, r.pearson_r);
  }

  // Get unique predictors (maintain sort order from results)
  const seen = new Set<string>();
  const predictors: { key: string; label: string }[] = [];
  for (const r of results) {
    if (!seen.has(r.predictor) && PRIMARY_OUTCOMES.includes(r.outcome)) {
      seen.add(r.predictor);
      predictors.push({ key: r.predictor, label: r.predictor_label });
    }
  }

  if (predictors.length === 0) {
    return null;
  }

  // Limit to top 12 predictors for readability
  const rows = predictors.slice(0, 12);
  const cols = PRIMARY_OUTCOMES;

  const width = PAD.left + cols.length * CELL + 10;
  const height = PAD.top + rows.length * CELL + 10;

  return (
    <div
      className="analysis-card analysis-card-wide"
      data-testid="correlation-heatmap"
    >
      <h3 className="analysis-card-title">Correlation Matrix</h3>
      <svg viewBox={`0 0 ${width} ${height}`} className="heatmap-svg">
        {/* Column headers */}
        {cols.map((col, ci) => (
          <text
            key={col}
            x={PAD.left + ci * CELL + CELL / 2}
            y={PAD.top - 8}
            textAnchor="middle"
            fill="var(--color-text-muted)"
            fontSize="10"
          >
            {OUTCOME_SHORT[col] ?? col}
          </text>
        ))}

        {/* Rows */}
        {rows.map((row, ri) => (
          <g key={row.key}>
            {/* Row label */}
            <text
              x={PAD.left - 6}
              y={PAD.top + ri * CELL + CELL / 2 + 4}
              textAnchor="end"
              fill="var(--color-text-secondary)"
              fontSize="9"
            >
              {/* #104: full label + native tooltip — no truncation */}
              <title>{row.label}</title>
              {row.label}
            </text>

            {/* Cells */}
            {cols.map((col, ci) => {
              const key = `${row.key}:${col}`;
              const r = lookup.get(key);
              return (
                <g key={key}>
                  <rect
                    x={PAD.left + ci * CELL + 1}
                    y={PAD.top + ri * CELL + 1}
                    width={CELL - 2}
                    height={CELL - 2}
                    fill={r != null ? cellColor(r) : "var(--color-bg-elevated)"}
                    rx="3"
                  />
                  <text
                    x={PAD.left + ci * CELL + CELL / 2}
                    y={PAD.top + ri * CELL + CELL / 2 + 4}
                    textAnchor="middle"
                    fill="var(--color-text-primary)"
                    fontSize="9"
                  >
                    {r != null ? fmtR(r) : "—"}
                  </text>
                </g>
              );
            })}
          </g>
        ))}
      </svg>
    </div>
  );
}
