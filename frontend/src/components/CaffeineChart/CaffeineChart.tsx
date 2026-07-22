import {
  curveEndHour,
  formatClockLabel,
  mgAtHour,
  wrapBedtimeHour,
  type CaffeinePoint,
} from "./caffeineCalc";
import "./CaffeineChart.css";

interface CaffeineChartProps {
  points: CaffeinePoint[];
  bedtimeHour: number | null;
}

const WIDTH = 600;
const HEIGHT = 200;
const PADDING = { top: 20, right: 20, bottom: 30, left: 50 };
const CHART_W = WIDTH - PADDING.left - PADDING.right;
const CHART_H = HEIGHT - PADDING.top - PADDING.bottom;

export function CaffeineChart({ points, bedtimeHour }: CaffeineChartProps) {
  if (points.length === 0) return null;

  // After-midnight bedtimes (e.g. 00:30 → 0.5) live on the evening scale:
  // wrap to 24+ (mirroring the backend) and extend the x-domain past 24 so
  // the marker sits inside the plot over a curve that reaches it.
  const wrappedBedtime =
    bedtimeHour != null ? wrapBedtimeHour(bedtimeHour) : null;
  const maxHour = curveEndHour(bedtimeHour);

  const maxMg = Math.max(100, ...points.map((p) => p.mg));

  const x = (hour: number) => PADDING.left + (hour / maxHour) * CHART_W;
  const y = (mg: number) => PADDING.top + CHART_H - (mg / maxMg) * CHART_H;

  const polyline = points.map((p) => `${x(p.hour)},${y(p.mg)}`).join(" ");

  // Threshold line at 100mg
  const thresholdY = y(100);

  // X-axis labels
  const xLabels = [0, 6, 12, 18, 24];

  return (
    <div className="caffeine-chart">
      <h4 className="caffeine-chart-title">Caffeine Decay</h4>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="caffeine-chart-svg">
        {/* Grid */}
        <line
          x1={PADDING.left}
          y1={PADDING.top}
          x2={PADDING.left}
          y2={PADDING.top + CHART_H}
          stroke="var(--color-border)"
          strokeWidth="1"
        />
        <line
          x1={PADDING.left}
          y1={PADDING.top + CHART_H}
          x2={PADDING.left + CHART_W}
          y2={PADDING.top + CHART_H}
          stroke="var(--color-border)"
          strokeWidth="1"
        />

        {/* 100mg threshold */}
        {maxMg >= 100 && (
          <>
            <line
              x1={PADDING.left}
              y1={thresholdY}
              x2={PADDING.left + CHART_W}
              y2={thresholdY}
              stroke="var(--color-warning)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text
              x={PADDING.left - 4}
              y={thresholdY + 4}
              textAnchor="end"
              fill="var(--color-warning)"
              fontSize="10"
            >
              100mg
            </text>
          </>
        )}

        {/* Bedtime marker */}
        {wrappedBedtime != null && (
          <>
            <line
              x1={x(wrappedBedtime)}
              y1={PADDING.top}
              x2={x(wrappedBedtime)}
              y2={PADDING.top + CHART_H}
              stroke="var(--color-error)"
              strokeWidth="1.5"
              strokeDasharray="6 3"
            />
            <text
              x={
                wrappedBedtime > 18
                  ? x(wrappedBedtime) - 4
                  : x(wrappedBedtime) + 4
              }
              y={PADDING.top + 10}
              textAnchor={wrappedBedtime > 18 ? "end" : "start"}
              fill="var(--color-error)"
              fontSize="10"
            >
              {`Bedtime ${formatClockLabel(wrappedBedtime)}`}
            </text>
          </>
        )}

        {/* Decay curve */}
        <polyline
          points={polyline}
          fill="none"
          stroke="var(--color-chart-1)"
          strokeWidth="2"
        />

        {/* X-axis labels */}
        {xLabels.map((h) => (
          <text
            key={h}
            x={x(h)}
            y={HEIGHT - 5}
            textAnchor="middle"
            fill="var(--color-text-muted)"
            fontSize="10"
          >
            {h === 0 || h === 24
              ? "12a"
              : h === 12
                ? "12p"
                : h < 12
                  ? `${h}a`
                  : `${h - 12}p`}
          </text>
        ))}

        {/* Y-axis labels */}
        <text
          x={PADDING.left - 4}
          y={PADDING.top + 4}
          textAnchor="end"
          fill="var(--color-text-muted)"
          fontSize="10"
        >
          {Math.round(maxMg)}mg
        </text>
        <text
          x={PADDING.left - 4}
          y={PADDING.top + CHART_H + 4}
          textAnchor="end"
          fill="var(--color-text-muted)"
          fontSize="10"
        >
          0mg
        </text>
      </svg>
      {wrappedBedtime != null && (
        <p className="caffeine-chart-bedtime-callout">
          {`≈${Math.round(mgAtHour(points, wrappedBedtime))} mg at bedtime`}
        </p>
      )}
    </div>
  );
}
