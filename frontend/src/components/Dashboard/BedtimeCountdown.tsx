import { useEffect, useState } from "react";
import { getTiming } from "../../api/analysis";
import { computeBedtimeStatus, parseTime } from "../../bedtime";

/** #58: bedtime-target countdown (PLAN §6).
 *
 * Target priority: the analysis engine's optimal-bedtime window (≥50 days
 * of data) → the user's typical bedtime → nothing (card hidden). The
 * status line re-computes every 30s while the dashboard is open.
 */

interface BedtimeCountdownProps {
  typicalBedtime: string | null;
}

interface Target {
  start: number;
  end: number | null;
  source: "optimal" | "typical";
}

export function BedtimeCountdown({ typicalBedtime }: BedtimeCountdownProps) {
  const [target, setTarget] = useState<Target | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    const fallback = (): Target | null => {
      const typical = parseTime(typicalBedtime);
      return typical === null
        ? null
        : { start: typical, end: null, source: "typical" };
    };
    getTiming()
      .then((timing) => {
        if (cancelled) return;
        if (timing.optimal_bedtime_start !== null) {
          setTarget({
            start: timing.optimal_bedtime_start,
            end: timing.optimal_bedtime_end,
            source: "optimal",
          });
        } else {
          setTarget(fallback());
        }
      })
      .catch(() => {
        if (!cancelled) setTarget(fallback());
      });
    return () => {
      cancelled = true;
    };
  }, [typicalBedtime]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  if (target === null) return null;

  const status = computeBedtimeStatus(
    target.start,
    target.end,
    target.source,
    now,
  );

  return (
    <div className="dashboard-card" data-testid="bedtime-countdown">
      <h3 className="dashboard-card-title">Bedtime</h3>
      <div className="bedtime-countdown-label">{status.label}</div>
      <div className="bedtime-countdown-detail">{status.detail}</div>
    </div>
  );
}
