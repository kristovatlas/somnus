/** 2x2 grid showing current vs prior metric averages with trend arrows. */

import type { MetricAverages, TrendArrows } from '../../types'

interface Props {
  current: MetricAverages
  prior: MetricAverages
  trends: TrendArrows
}

function trendArrow(direction: string | null): string {
  if (direction === 'up') return '\u2191'
  if (direction === 'down') return '\u2193'
  if (direction === 'flat') return '\u2192'
  return '\u2014'
}

function trendClass(direction: string | null): string {
  if (direction === 'up') return 'report-trend-up'
  if (direction === 'down') return 'report-trend-down'
  return 'report-trend-flat'
}

function fmt(val: number | null): string {
  if (val === null) return '\u2014'
  return val.toFixed(1)
}

export function MetricsComparisonCard({ current, prior, trends }: Props) {
  const metrics = [
    { label: 'Sleep Score', cur: current.avg_sleep_score, pri: prior.avg_sleep_score, trend: trends.sleep_score },
    { label: 'HRV', cur: current.avg_hrv, pri: prior.avg_hrv, trend: trends.avg_hrv },
    { label: 'Deep Sleep', cur: current.avg_deep_minutes, pri: prior.avg_deep_minutes, trend: trends.deep_minutes, unit: 'min' },
    { label: 'REM Sleep', cur: current.avg_rem_minutes, pri: prior.avg_rem_minutes, trend: trends.rem_minutes, unit: 'min' },
  ]

  return (
    <div className="report-card" data-testid="metrics-comparison">
      <h3 className="report-card-title">Metrics</h3>
      <div className="report-metrics-grid">
        {metrics.map((m) => (
          <div key={m.label} className="report-metric-cell">
            <div className="report-metric-label">{m.label}</div>
            <div className="report-metric-value">
              {fmt(m.cur)}{m.unit ? ` ${m.unit}` : ''}
            </div>
            <div className="report-metric-row">
              <span className={trendClass(m.trend)}>{trendArrow(m.trend)}</span>
              <span className="report-metric-prior">{fmt(m.pri)}{m.unit ? ` ${m.unit}` : ''}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
