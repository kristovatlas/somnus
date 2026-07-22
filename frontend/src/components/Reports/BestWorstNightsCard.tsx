/** Side-by-side best and worst nights with contributing factors. */

import type { NightSummary } from "../../types";

interface Props {
  best: NightSummary | null;
  worst: NightSummary | null;
}

/** Compact context line (#113), e.g.
 * "Tue · slept 11:42 PM · 7h 38m · deep 71m · REM 96m · HRV 44".
 * Unrecorded fields are simply omitted (NULL = not recorded). */
function nightDetails(night: NightSummary): string {
  const parts: string[] = [];
  if (night.weekday) parts.push(night.weekday.slice(0, 3));
  if (night.bedtime) parts.push(`slept ${night.bedtime}`);
  if (night.total_sleep_minutes != null) {
    const h = Math.floor(night.total_sleep_minutes / 60);
    const m = night.total_sleep_minutes % 60;
    parts.push(`${h}h ${m}m`);
  }
  if (night.deep_minutes != null) parts.push(`deep ${night.deep_minutes}m`);
  if (night.rem_minutes != null) parts.push(`REM ${night.rem_minutes}m`);
  if (night.avg_hrv != null) parts.push(`HRV ${Math.round(night.avg_hrv)}`);
  return parts.join(" · ");
}

function NightPanel({ night, label }: { night: NightSummary; label: string }) {
  const details = nightDetails(night);
  return (
    <div className="report-night-panel">
      <div className="report-night-label">{label}</div>
      <div className="report-night-date">{night.date}</div>
      <div className="report-night-score">Score: {night.sleep_score}</div>
      {details && <div className="report-muted">{details}</div>}
      {night.contributing_factors.length > 0 && (
        <div className="report-night-factors">
          {night.contributing_factors.map((f) => (
            <span key={f} className="report-factor-tag">
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function BestWorstNightsCard({ best, worst }: Props) {
  if (!best && !worst) return null;

  return (
    <div className="report-card" data-testid="best-worst-nights">
      <h3 className="report-card-title">Best &amp; Worst Nights</h3>
      <div className="report-nights-row">
        {best && <NightPanel night={best} label="Best" />}
        {worst && <NightPanel night={worst} label="Worst" />}
      </div>
    </div>
  );
}
