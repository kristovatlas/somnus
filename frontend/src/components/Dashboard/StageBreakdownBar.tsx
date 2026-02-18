/** Horizontal stacked bar for sleep stages with target comparison. */

import type { SleepRecordOut, StageAverages, StageTargets } from '../../types'

interface StageBreakdownBarProps {
  record: SleepRecordOut | null
  averages: StageAverages | null
  targets: StageTargets | null
}

const BAR_W = 400
const BAR_H = 28

function ratingColor(rating: string): string {
  if (rating === 'in_range') return 'var(--color-success)'
  if (rating === 'above') return 'var(--color-warning)'
  return 'var(--color-error)'
}

export function StageBreakdownBar({ record, averages, targets }: StageBreakdownBarProps) {
  if (!record || record.total_sleep_minutes == null) {
    return (
      <div className="dashboard-card" data-testid="stage-breakdown">
        <h3 className="dashboard-card-title">Sleep Stages</h3>
        <p className="dashboard-empty">No stage data available.</p>
      </div>
    )
  }

  const total = record.total_sleep_minutes
  const deep = record.deep_minutes ?? 0
  const rem = record.rem_minutes ?? 0
  const light = record.light_minutes ?? 0

  const deepW = total > 0 ? (deep / total) * BAR_W : 0
  const remW = total > 0 ? (rem / total) * BAR_W : 0
  const lightW = total > 0 ? (light / total) * BAR_W : 0

  return (
    <div className="dashboard-card" data-testid="stage-breakdown">
      <h3 className="dashboard-card-title">Sleep Stages</h3>
      <svg viewBox={`0 0 ${BAR_W} ${BAR_H}`} className="stage-bar-svg">
        <rect x={0} y={0} width={deepW} height={BAR_H} fill="var(--color-chart-2)" rx="4" />
        <rect x={deepW} y={0} width={remW} height={BAR_H} fill="var(--color-chart-1)" />
        <rect x={deepW + remW} y={0} width={lightW} height={BAR_H} fill="var(--color-chart-4)" rx="4" />
      </svg>
      <div className="stage-labels">
        <span style={{ color: 'var(--color-chart-2)' }}>Deep {deep}m</span>
        <span style={{ color: 'var(--color-chart-1)' }}>REM {rem}m</span>
        <span style={{ color: 'var(--color-chart-4)' }}>Light {light}m</span>
      </div>

      {averages && (
        <div className="stage-averages">
          <span className="stage-avg-label">7-day avg:</span>
          <span style={{ color: ratingColor(averages.deep_vs_target) }}>
            Deep {Math.round(averages.avg_deep_minutes)}m
          </span>
          <span style={{ color: ratingColor(averages.rem_vs_target) }}>
            REM {Math.round(averages.avg_rem_minutes)}m
          </span>
        </div>
      )}

      {!targets && (
        <p className="dashboard-hint">Set your age in Settings for targets.</p>
      )}
    </div>
  )
}
