/** Segmented nap impact analysis grid. */

import type { NapData } from "../../types";

interface NapImpactViewProps {
  data: NapData;
}

function deltaColor(delta: number | null): string {
  if (delta == null) return "var(--color-text-muted)";
  if (delta > 5) return "var(--color-error)"; // worse
  if (delta < -5) return "var(--color-success)"; // better
  return "var(--color-text-secondary)";
}

export function NapImpactView({ data }: NapImpactViewProps) {
  if (data.total_nap_days === 0 && data.total_no_nap_days === 0) {
    return (
      <div className="analysis-card" data-testid="nap-impact">
        <h3 className="analysis-card-title">Nap Impact</h3>
        <p className="analysis-empty">No nap data recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="analysis-card analysis-card-wide" data-testid="nap-impact">
      <h3 className="analysis-card-title">Nap Impact</h3>
      <p className="analysis-card-subtitle">
        How naps are associated with next-night sleep onset latency
      </p>

      <div className="nap-baseline">
        <span>No-nap baseline ({data.total_no_nap_days} days):</span>
        {data.no_nap_baseline.avg_onset_latency != null && (
          <span>
            onset {data.no_nap_baseline.avg_onset_latency.toFixed(0)} min
          </span>
        )}
        {data.no_nap_baseline.avg_efficiency != null && (
          <span>
            eff {(data.no_nap_baseline.avg_efficiency * 100).toFixed(0)}%
          </span>
        )}
      </div>

      {data.segments.length > 0 && (
        <table className="nap-table">
          <thead>
            <tr>
              <th>Timing</th>
              <th>Duration</th>
              <th>Days</th>
              <th>Onset Δ</th>
            </tr>
          </thead>
          <tbody>
            {data.segments.map((seg) => (
              <tr key={`${seg.timing_label}-${seg.duration_label}`}>
                <td>{seg.timing_label}</td>
                <td>{seg.duration_label}</td>
                <td>{seg.n_days}</td>
                <td style={{ color: deltaColor(seg.vs_no_nap_onset) }}>
                  {seg.vs_no_nap_onset != null
                    ? `${seg.vs_no_nap_onset > 0 ? "+" : ""}${seg.vs_no_nap_onset.toFixed(1)} min`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
