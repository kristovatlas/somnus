import { useCallback, useEffect, useState } from 'react'
import { getSettings, updateSettings } from '../api/settings'
import type { UserSettingsOut, UserSettingsUpdate } from '../types'

export function useSettings() {
  const [settings, setSettings] = useState<UserSettingsOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const update = useCallback(async (data: UserSettingsUpdate) => {
    const updated = await updateSettings(data)
    setSettings(updated)
    return updated
  }, [])

  return { settings, loading, error, update }
}
