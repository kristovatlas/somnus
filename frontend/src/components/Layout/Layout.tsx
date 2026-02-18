import { useEffect, useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { getSettings } from '../../api/settings'
import type { UserSettingsOut } from '../../types'
import './Layout.css'

export function Layout() {
  const [settings, setSettings] = useState<UserSettingsOut | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch(() => {
        // Settings not available yet — treat as needing onboarding
        setSettings(null)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (loading || !settings) return

    const onOnboarding = location.pathname.startsWith('/onboarding')

    if (!settings.onboarding_completed && !onOnboarding) {
      navigate('/onboarding', { replace: true })
    } else if (settings.onboarding_completed && onOnboarding) {
      navigate('/log', { replace: true })
    }
  }, [settings, loading, location.pathname, navigate])

  if (loading) {
    return (
      <div className="layout">
        <div className="layout-loading">Loading...</div>
      </div>
    )
  }

  return (
    <div className="layout">
      <header className="layout-header">
        <h1 className="layout-title" onClick={() => navigate('/log')} role="button" tabIndex={0}>
          Somnus
        </h1>
        <button
          className="layout-settings-btn"
          onClick={() => navigate('/settings')}
          aria-label="Settings"
          title="Settings"
        >
          &#9881;
        </button>
      </header>
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  )
}
