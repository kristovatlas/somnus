/** Weekly report view with period navigation. */

import { useWeeklyReport } from "../../hooks/useReports";
import { weeklyExportUrl } from "../../api/reports";
import { MetricsComparisonCard } from "./MetricsComparisonCard";
import { TopFactorsCard } from "./TopFactorsCard";

interface Props {
  year: number;
  week: number;
  onNavigate: (year: number, week: number) => void;
}

function formatWeekRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-US", opts)} \u2013 ${e.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

function prevWeek(year: number, week: number): [number, number] {
  if (week <= 1) return [year - 1, 52];
  return [year, week - 1];
}

function nextWeek(year: number, week: number): [number, number] {
  if (week >= 52) return [year + 1, 1];
  return [year, week + 1];
}

export function WeeklyReportView({ year, week, onNavigate }: Props) {
  const { data, loading, error } = useWeeklyReport(year, week);

  if (loading)
    return <div className="report-empty">Loading weekly report...</div>;
  if (error) return <div className="report-error">{error}</div>;
  if (!data) return <div className="report-error">No data available.</div>;

  const now = new Date();
  const currentIsoYear = getISOYear(now);
  const currentIsoWeek = getISOWeek(now);

  return (
    <div data-testid="weekly-report-view">
      <div className="report-nav">
        <button
          className="report-nav-btn"
          onClick={() => onNavigate(...prevWeek(year, week))}
          aria-label="Previous week"
        >
          &#9664;
        </button>
        <span className="report-period-label">
          {formatWeekRange(data.period_start, data.period_end)}
        </span>
        <button
          className="report-nav-btn"
          onClick={() => onNavigate(...nextWeek(year, week))}
          aria-label="Next week"
        >
          &#9654;
        </button>
        {(year !== currentIsoYear || week !== currentIsoWeek) && (
          <button
            className="report-nav-today"
            onClick={() => onNavigate(currentIsoYear, currentIsoWeek)}
          >
            This week
          </button>
        )}
      </div>

      {data.has_insufficient_data && (
        <div className="report-insufficient" data-testid="insufficient-data">
          Not enough data for a full report. Need at least 2 nights of sleep
          data this week.
        </div>
      )}

      <div className="report-completeness">
        Logged {data.logging_completeness}
      </div>

      <MetricsComparisonCard
        current={data.current}
        prior={data.prior}
        trends={data.trends}
      />

      {data.consistency && (
        <div className="report-card" data-testid="consistency-card">
          <h3 className="report-card-title">Bedtime Consistency</h3>
          <div className="report-consistency-pills">
            <span className="report-pill">
              {"\u03C3"} {data.consistency.sigma_minutes.toFixed(0)} min
            </span>
            {data.consistency.delta_minutes !== null && (
              <span className="report-pill">
                {"\u03B4"} {data.consistency.delta_minutes.toFixed(0)} min
              </span>
            )}
            {data.consistency.weekend_drift_minutes !== null && (
              <span className="report-pill">
                {"\u0394"} {data.consistency.weekend_drift_minutes.toFixed(0)}{" "}
                min
              </span>
            )}
          </div>
        </div>
      )}

      <TopFactorsCard
        positive={data.top_positive_factor}
        negative={data.top_negative_factor}
      />

      <div className="report-export">
        <a
          href={weeklyExportUrl(year, week)}
          target="_blank"
          rel="noopener noreferrer"
          className="report-export-link"
        >
          Export as HTML
        </a>
      </div>
    </div>
  );
}

// ISO week helpers (avoid library dependency)
function getISOWeek(d: Date): number {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((date.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7,
    )
  );
}

function getISOYear(d: Date): number {
  const date = new Date(d.getTime());
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  return date.getFullYear();
}
