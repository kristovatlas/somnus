/** Horizontal bar chart with CI whiskers for regression coefficients. */

import type { RegressionResult } from "../../types";

interface CoefficientChartProps {
  result: RegressionResult;
}

const WIDTH = 500;
const ROW_H = 28;
const PAD = { left: 160, right: 30, top: 10, bottom: 10 };
const CHART_W = WIDTH - PAD.left - PAD.right;

export function CoefficientChart({ result }: CoefficientChartProps) {
  const coefs = result.coefficients.filter(
    (c) => !c.predictor.endsWith("_lag1"),
  );

  if (coefs.length === 0) return null;

  const maxAbs = Math.max(
    ...coefs.map((c) =>
      Math.max(
        Math.abs(c.coefficient),
        Math.abs(c.ci_lower ?? c.coefficient),
        Math.abs(c.ci_upper ?? c.coefficient),
      ),
    ),
    0.01,
  );

  const height = PAD.top + coefs.length * ROW_H + PAD.bottom;
  const zeroX = PAD.left + CHART_W / 2;

  const scale = (v: number) => zeroX + (v / maxAbs) * (CHART_W / 2);

  return (
    <div
      className="analysis-card analysis-card-wide"
      data-testid="coefficient-chart"
    >
      <h3 className="analysis-card-title">{result.outcome_label}</h3>
      <div className="coefficient-meta">
        <span>R² = {result.r_squared.toFixed(3)}</span>
        <span>n = {result.n_days}</span>
        {result.multicollinearity_warning && (
          <span className="coefficient-warning">VIF warning</span>
        )}
      </div>

      <svg viewBox={`0 0 ${WIDTH} ${height}`} className="coefficient-svg">
        {/* Zero line */}
        <line
          x1={zeroX}
          y1={PAD.top}
          x2={zeroX}
          y2={height - PAD.bottom}
          stroke="var(--color-border)"
          strokeWidth="1"
        />

        {coefs.map((c, i) => {
          const y = PAD.top + i * ROW_H + ROW_H / 2;
          const barX = scale(c.coefficient);
          const barColor = c.is_significant
            ? c.coefficient > 0
              ? "var(--color-chart-1)"
              : "var(--color-error)"
            : "var(--color-text-muted)";

          return (
            <g key={c.predictor}>
              {/* Label */}
              <text
                x={PAD.left - 6}
                y={y + 4}
                textAnchor="end"
                fill="var(--color-text-secondary)"
                fontSize="10"
              >
                {c.predictor_label.length > 22
                  ? c.predictor_label.slice(0, 20) + "..."
                  : c.predictor_label}
              </text>

              {/* Bar from zero */}
              <rect
                x={Math.min(zeroX, barX)}
                y={y - 5}
                width={Math.abs(barX - zeroX)}
                height={10}
                fill={barColor}
                rx="2"
                opacity={c.is_significant ? 0.9 : 0.4}
              />

              {/* CI whiskers */}
              {c.ci_lower != null && c.ci_upper != null && (
                <>
                  <line
                    x1={scale(c.ci_lower)}
                    y1={y}
                    x2={scale(c.ci_upper)}
                    y2={y}
                    stroke={barColor}
                    strokeWidth="1.5"
                  />
                  <line
                    x1={scale(c.ci_lower)}
                    y1={y - 4}
                    x2={scale(c.ci_lower)}
                    y2={y + 4}
                    stroke={barColor}
                    strokeWidth="1"
                  />
                  <line
                    x1={scale(c.ci_upper)}
                    y1={y - 4}
                    x2={scale(c.ci_upper)}
                    y2={y + 4}
                    stroke={barColor}
                    strokeWidth="1"
                  />
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
