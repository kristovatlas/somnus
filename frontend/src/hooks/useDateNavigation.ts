import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function useDateNavigation() {
  const { date } = useParams<{ date: string }>()
  const navigate = useNavigate()

  const currentDate = date ?? todayStr()
  const isToday = currentDate === todayStr()

  const goTo = useCallback(
    (d: string) => navigate(`/log/${d}`),
    [navigate],
  )
  const prev = useCallback(() => goTo(addDays(currentDate, -1)), [currentDate, goTo])
  const next = useCallback(() => goTo(addDays(currentDate, 1)), [currentDate, goTo])
  const today = useCallback(() => goTo(todayStr()), [goTo])

  return { currentDate, isToday, goTo, prev, next, today }
}
