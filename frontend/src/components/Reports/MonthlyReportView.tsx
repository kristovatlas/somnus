/** Monthly report view with period navigation. */

import { useState } from 'react'
import { useMonthlyReport } from '../../hooks/useReports'
import { monthlyExportUrl } from '../../api/reports'
import { MetricsComparisonCard } from './MetricsComparisonCard'
import { BestWorstNightsCard } from './BestWorstNightsCard'
import { StageComplianceCard } from './StageComplianceCard'

interface Props {
  year: number
  month: number
  onNavigate: (year: number, month: number) => void
}

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function prevMonth(year: number, month: number): [number, number] {
  if (month <= 1) return [year - 1, 12]
  return [year, month - 1]
}

function nextMonth(year: number, month: number): [number, number] {
  if (month >= 12) return [year + 1, 1]
  return [year, month + 1]
}

export function MonthlyReportView({ year, month, onNavigate }: Props) {
  const { data, loading, error } = useMonthlyReport(year, month)
  const [weekliesOpen, setWeekliesOpen] = useState(false)

  if (loading) return <div className="report-empty">Loading monthly report...</div>
  if (error) return <div className="report-error">{error}</div>
  if (!data) return <div className="report-error">No data available.</div>

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  return (
    <div data-testid="monthly-report-view">
      <div className="report-nav">
        <button
          className="report-nav-btn"
          onClick={() => onNavigate(...prevMonth(year, month))}
          aria-label="Previous month"
        >
          &#9664;
        </button>
        <span className="report-period-label">
          {MONTH_NAMES[month]} {year}
        </span>
        <button
          className="report-nav-btn"
          onClick={() => onNavigate(...nextMonth(year, month))}
          aria-label="Next month"
        >
          &#9654;
        </button>
        {(year !== currentYear || month !== currentMonth) && (
          <button
            className="report-nav-today"
            onClick={() => onNavigate(currentYear, currentMonth)}
          >
            This month
          </button>
        )}
      </div>

      {data.has_insufficient_data && (
        <div className="report-insufficient" data-testid="insufficient-data">
          Not enough data for a full report. Need at least 4 nights of sleep data this month.
        </div>
      )}

      <div className="report-completeness">
        Logged {data.logging_completeness}
      </div>

      <MetricsComparisonCard current={data.current} prior={data.prior} trends={data.trends} />

      <BestWorstNightsCard best={data.best_night} worst={data.worst_night} />

      <StageComplianceCard compliance={data.stage_compliance} />

      {data.active_experiment && (
        <div className="report-card" data-testid="experiment-section">
          <h3 className="report-card-title">Active Experiment</h3>
          <p>
            <strong>{data.active_experiment.factor_label}</strong>: {data.active_experiment.hypothesis}
          </p>
          <p className="report-muted">
            {data.active_experiment.start_date} to {data.active_experiment.end_date}
            {' \u2014 '}{data.active_experiment.days_completed} days completed
          </p>
        </div>
      )}

      {data.weekly_summaries.length > 0 && (
        <div className="report-card">
          <button
            className="report-collapsible-toggle"
            onClick={() => setWeekliesOpen(!weekliesOpen)}
          >
            {weekliesOpen ? '\u25BC' : '\u25B6'} Weekly Summaries ({data.weekly_summaries.length})
          </button>
          {weekliesOpen && (
            <div className="report-weekly-list" data-testid="weekly-summaries">
              {data.weekly_summaries.map((ws) => (
                <div key={`${ws.iso_year}-${ws.iso_week}`} className="report-weekly-item">
                  <span className="report-weekly-label">
                    Week {ws.iso_week}: {ws.period_start} – {ws.period_end}
                  </span>
                  <span className="report-weekly-score">
                    Score: {ws.current.avg_sleep_score?.toFixed(1) ?? '\u2014'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="report-export">
        <a href={monthlyExportUrl(year, month)} target="_blank" rel="noopener noreferrer" className="report-export-link">
          Export as HTML
        </a>
      </div>
    </div>
  )
}
