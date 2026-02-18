/** Reusable SVG sparkline — skips nulls, highlights last point. */

interface SparklineProps {
  points: (number | null)[]
  color: string
  width?: number
  height?: number
  label?: string
}

const PAD = 4

export function Sparkline({ points, color, width = 120, height = 40, label }: SparklineProps) {
  const valid = points
    .map((v, i) => (v != null ? { i, v } : null))
    .filter((p): p is { i: number; v: number } => p !== null)

  if (valid.length === 0) {
    return (
      <div className="sparkline" role="img" aria-label={label ?? 'sparkline'}>
        <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
          <text
            x={width / 2}
            y={height / 2 + 4}
            textAnchor="middle"
            fill="var(--color-text-muted)"
            fontSize="10"
          >
            —
          </text>
        </svg>
      </div>
    )
  }

  const n = points.length
  const minV = Math.min(...valid.map((p) => p.v))
  const maxV = Math.max(...valid.map((p) => p.v))
  const range = maxV - minV || 1

  const x = (i: number) => PAD + ((width - 2 * PAD) * i) / Math.max(n - 1, 1)
  const y = (v: number) => height - PAD - ((height - 2 * PAD) * (v - minV)) / range

  const polyline = valid.map((p) => `${x(p.i)},${y(p.v)}`).join(' ')
  const last = valid[valid.length - 1]

  return (
    <div className="sparkline" role="img" aria-label={label ?? 'sparkline'}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
        <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.5" />
        <circle cx={x(last.i)} cy={y(last.v)} r="2.5" fill={color} />
      </svg>
    </div>
  )
}
