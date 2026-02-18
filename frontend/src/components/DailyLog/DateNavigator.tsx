import './DateNavigator.css'

interface DateNavigatorProps {
  date: string
  isToday: boolean
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function DateNavigator({ date, isToday, onPrev, onNext, onToday }: DateNavigatorProps) {
  return (
    <div className="date-nav">
      <button type="button" className="date-nav-arrow" onClick={onPrev} aria-label="Previous day">
        &larr;
      </button>
      <div className="date-nav-center">
        <span className="date-nav-date">{formatDate(date)}</span>
        {isToday && <span className="date-nav-today-badge">Today</span>}
      </div>
      <button type="button" className="date-nav-arrow" onClick={onNext} aria-label="Next day">
        &rarr;
      </button>
      {!isToday && (
        <button type="button" className="date-nav-today-btn" onClick={onToday}>
          Today
        </button>
      )}
    </div>
  )
}
