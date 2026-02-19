/** Side-by-side best and worst nights with contributing factors. */

import type { NightSummary } from '../../types'

interface Props {
  best: NightSummary | null
  worst: NightSummary | null
}

function NightPanel({ night, label }: { night: NightSummary; label: string }) {
  return (
    <div className="report-night-panel">
      <div className="report-night-label">{label}</div>
      <div className="report-night-date">{night.date}</div>
      <div className="report-night-score">Score: {night.sleep_score}</div>
      {night.contributing_factors.length > 0 && (
        <div className="report-night-factors">
          {night.contributing_factors.map((f) => (
            <span key={f} className="report-factor-tag">{f}</span>
          ))}
        </div>
      )}
    </div>
  )
}

export function BestWorstNightsCard({ best, worst }: Props) {
  if (!best && !worst) return null

  return (
    <div className="report-card" data-testid="best-worst-nights">
      <h3 className="report-card-title">Best &amp; Worst Nights</h3>
      <div className="report-nights-row">
        {best && <NightPanel night={best} label="Best" />}
        {worst && <NightPanel night={worst} label="Worst" />}
      </div>
    </div>
  )
}
