/** Reports page — orchestrates weekly/monthly report views. */

import { useState } from 'react'
import { WeeklyReportView } from './WeeklyReportView'
import { MonthlyReportView } from './MonthlyReportView'
import './ReportsPage.css'

function getISOWeek(d: Date): number {
  const date = new Date(d.getTime())
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7))
  const week1 = new Date(date.getFullYear(), 0, 4)
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
}

function getISOYear(d: Date): number {
  const date = new Date(d.getTime())
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7))
  return date.getFullYear()
}

type TabMode = 'week' | 'month'

export function ReportsPage() {
  const now = new Date()
  const [tab, setTab] = useState<TabMode>('week')

  // Weekly state
  const [weekYear, setWeekYear] = useState(getISOYear(now))
  const [week, setWeek] = useState(getISOWeek(now))

  // Monthly state
  const [monthYear, setMonthYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  return (
    <div data-testid="reports-page">
      <div className="report-tabs">
        <button
          className={`report-tab${tab === 'week' ? ' active' : ''}`}
          onClick={() => setTab('week')}
        >
          Weekly
        </button>
        <button
          className={`report-tab${tab === 'month' ? ' active' : ''}`}
          onClick={() => setTab('month')}
        >
          Monthly
        </button>
      </div>

      {tab === 'week' ? (
        <WeeklyReportView
          year={weekYear}
          week={week}
          onNavigate={(y, w) => { setWeekYear(y); setWeek(w) }}
        />
      ) : (
        <MonthlyReportView
          year={monthYear}
          month={month}
          onNavigate={(y, m) => { setMonthYear(y); setMonth(m) }}
        />
      )}
    </div>
  )
}
