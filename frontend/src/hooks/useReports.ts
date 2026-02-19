import { useCallback, useEffect, useRef, useState } from 'react'
import { getWeeklyReport, getMonthlyReport } from '../api/reports'
import type { WeeklyReport, MonthlyReport } from '../types'

export function useWeeklyReport(year?: number, week?: number) {
  const [data, setData] = useState<WeeklyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const versionRef = useRef(0)

  useEffect(() => {
    const version = ++versionRef.current
    getWeeklyReport(year, week)
      .then((result) => {
        if (version === versionRef.current) {
          setData(result)
          setError(null)
        }
      })
      .catch((e: unknown) => {
        if (version === versionRef.current) {
          setError(e instanceof Error ? e.message : 'Failed to load weekly report')
        }
      })
      .finally(() => {
        if (version === versionRef.current) setLoading(false)
      })
  }, [year, week])

  const refresh = useCallback(() => {
    setLoading(true)
    setError(null)
    getWeeklyReport(year, week)
      .then(setData)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to load weekly report')
      })
      .finally(() => setLoading(false))
  }, [year, week])

  return { data, loading, error, refresh }
}

export function useMonthlyReport(year?: number, month?: number) {
  const [data, setData] = useState<MonthlyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const versionRef = useRef(0)

  useEffect(() => {
    const version = ++versionRef.current
    getMonthlyReport(year, month)
      .then((result) => {
        if (version === versionRef.current) {
          setData(result)
          setError(null)
        }
      })
      .catch((e: unknown) => {
        if (version === versionRef.current) {
          setError(e instanceof Error ? e.message : 'Failed to load monthly report')
        }
      })
      .finally(() => {
        if (version === versionRef.current) setLoading(false)
      })
  }, [year, month])

  const refresh = useCallback(() => {
    setLoading(true)
    setError(null)
    getMonthlyReport(year, month)
      .then(setData)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to load monthly report')
      })
      .finally(() => setLoading(false))
  }, [year, month])

  return { data, loading, error, refresh }
}
